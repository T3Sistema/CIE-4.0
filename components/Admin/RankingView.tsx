import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getReportsByEvent, getParticipantCompaniesByEvent, getButtonConfigs, getStaffByEvent, getStaffActivity, getEventSalesData, getSoldVehiclesByEvent } from '../../services/api';
import { ReportSubmission, ParticipantCompany, ReportButtonConfig, Staff, StaffActivity, CompanySalesData, Collaborator, Vehicle } from '../../types';
import LoadingSpinner from '../LoadingSpinner';
import Button from '../Button';

// Tell TypeScript that jspdf is loaded globally from the CDN
declare const jspdf: any;

interface Props {
  eventId: string;
}

const MedalIcon: React.FC<{ position: number }> = ({ position }) => {
    const medals: { [key: number]: string } = {
        1: '🥇',
        2: '🥈',
        3: '🥉',
    };
    const medal = medals[position];

    if (!medal) return null;

    return (
        <span className="ml-2 flex-shrink-0 text-2xl" role="img" aria-label={`Medalha de ${position}º lugar`}>
            {medal}
        </span>
    );
};

type ChartData = {
  label: string;
  value: number;
  logoUrl?: string;
};

const DownloadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const RankingView: React.FC<Props> = ({ eventId }) => {
  const [reports, setReports] = useState<ReportSubmission[]>([]);
  const [companies, setCompanies] = useState<ParticipantCompany[]>([]);
  const [buttonConfigs, setButtonConfigs] = useState<ReportButtonConfig[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [activities, setActivities] = useState<Record<string, StaffActivity[]>>({});
  const [salesData, setSalesData] = useState<CompanySalesData[]>([]);
  const [soldVehicles, setSoldVehicles] = useState<Pick<Vehicle, 'model' | 'marca'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'visits' | 'occurrences' | 'staff' | 'salesByCompany' | 'salesBySeller' | 'salesMap'>('visits');
  const [selectedOccurrence, setSelectedOccurrence] = useState<string | null>(null);
  const [sellerCompanyFilter, setSellerCompanyFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsData, companiesData, buttonsData, staffData, eventSalesData, soldVehiclesData] = await Promise.all([
        getReportsByEvent(eventId),
        getParticipantCompaniesByEvent(eventId),
        getButtonConfigs(),
        getStaffByEvent(eventId),
        getEventSalesData(eventId),
        getSoldVehiclesByEvent(eventId)
      ]);
      setReports(reportsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      setCompanies(companiesData);
      setButtonConfigs(buttonsData);
      setStaffList(staffData);
      setSalesData(eventSalesData);
      setSoldVehicles(soldVehiclesData);

      if (staffData.length > 0) {
        const activityPromises = staffData.map(s => getStaffActivity(s.id, eventId));
        const activitiesData = await Promise.all(activityPromises);
        const activitiesMap: Record<string, StaffActivity[]> = {};
        staffData.forEach((s, index) => {
            activitiesMap[s.id] = activitiesData[index];
        });
        setActivities(activitiesMap);
      }

    } catch (error) {
      console.error("Failed to fetch ranking data:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const companyInfoMap = useMemo(() => {
    return companies.reduce((acc, company) => {
      acc[company.boothCode] = { name: company.name, logoUrl: company.logoUrl };
      return acc;
    }, {} as Record<string, { name: string, logoUrl?: string }>);
  }, [companies]);

  const questionMap = useMemo(() => {
    return buttonConfigs.reduce((acc, config) => {
      acc[config.label] = config.question;
      return acc;
    }, {} as Record<string, string>);
  }, [buttonConfigs]);

  const visitsData: ChartData[] = useMemo(() => {
    const counts = reports.reduce((acc, report) => {
      acc[report.boothCode] = (acc[report.boothCode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .map(([boothCode, value]) => ({
        label: companyInfoMap[boothCode]?.name || boothCode,
        value,
        logoUrl: companyInfoMap[boothCode]?.logoUrl,
      }))
      .sort((a, b) => b.value - a.value);
  }, [reports, companyInfoMap]);

  const occurrencesData: ChartData[] = useMemo(() => {
    const counts = reports.reduce((acc, report) => {
      // Ignora configs internas no ranking de ocorrências visíveis
      if (report.reportLabel.startsWith('__') && report.reportLabel.endsWith('__')) {
        return acc;
      }
      acc[report.reportLabel] = (acc[report.reportLabel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [reports]);
  
  const staffData: ChartData[] = useMemo(() => {
    return staffList
      .map(staff => ({
        label: staff.name,
        value: (activities[staff.id] || []).length,
        logoUrl: staff.photoUrl,
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [staffList, activities]);

  const rankedCompaniesBySales = useMemo(() => {
    return [...salesData].sort((a, b) => b.salesCount - a.salesCount);
  }, [salesData]);

  const rankedSellers = useMemo(() => {
    const allSellers = salesData.flatMap(company => company.collaborators);
    const filtered = sellerCompanyFilter === 'all'
      ? allSellers
      : allSellers.filter(seller => seller.companyId === sellerCompanyFilter);
    
    return filtered
        .filter(seller => seller.salesCount > 0)
        .sort((a, b) => b.salesCount - a.salesCount);
  }, [salesData, sellerCompanyFilter]);

  const maxSellerValue = useMemo(() => {
    return Math.max(...rankedSellers.map(s => s.salesCount), 0);
  }, [rankedSellers]);
  
  const salesMapData = useMemo(() => {
    const counts = soldVehicles.reduce((acc, vehicle) => {
        const modelName = vehicle.model || vehicle.marca || 'Desconhecido';
        acc[modelName] = (acc[modelName] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
  }, [soldVehicles]);

  const detailedReportsForSelectedOccurrence = useMemo(() => {
      if (!selectedOccurrence) return [];
      return reports.filter(r => r.reportLabel === selectedOccurrence);
  }, [reports, selectedOccurrence]);

  const handleDownloadOccurrencesPdf = (occurrenceLabels: string[]) => {
    if (occurrenceLabels.length === 0) return;

    const doc = new jspdf.jsPDF();
    let startY = 40;

    doc.setFontSize(18);
    doc.text('Relatório de Ocorrências', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
    
    occurrenceLabels.forEach((label, index) => {
      const reportsForOccurrence = reports.filter(r => r.reportLabel === label);
      if (reportsForOccurrence.length === 0) return;

      if (index > 0) {
        startY = doc.autoTable.previous.finalY + 15;
      }
      
      if (startY > 250) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(14);
      doc.text(label, 14, startY);
      
      const tableColumn = ["Estande", "Pergunta e Resposta", "Equipe", "Data/Hora"];
      const tableRows: string[][] = [];

      reportsForOccurrence.forEach(report => {
        const question = questionMap[report.reportLabel] || report.reportLabel;
        const responseText = `${question}\n\n${report.response}`;
        
        tableRows.push([
          companyInfoMap[report.boothCode]?.name || report.boothCode,
          responseText,
          report.staffName,
          new Date(report.timestamp).toLocaleString('pt-BR'),
        ]);
      });

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: startY + 5,
        theme: 'grid',
        headStyles: { fillColor: [18, 181, 229] }, // Cor primária
      });
    });

    const safeLabel = occurrenceLabels[0]?.replace(/[^\w]/g, '_').toLowerCase();
    const fileName = occurrenceLabels.length === 1 
      ? `relatorio_${safeLabel}.pdf`
      : 'relatorio_completo_ocorrencias.pdf';
    
    doc.save(fileName);
  };

  const handleDownloadVisitsPdf = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Visitas por Estande', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    const tableColumn = ["Posição", "Estande", "Nº de Visitas"];
    const tableRows: (string | number)[][] = [];

    visitsData.forEach((item, index) => {
        tableRows.push([index + 1, item.label, item.value]);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [18, 181, 229] },
    });

    doc.save('relatorio_visitas_estandes.pdf');
  };

  const handleDownloadStaffPdf = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Ranking por Equipe', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    const tableColumn = ["Posição", "Membro da Equipe", "Nº de Atividades"];
    const tableRows: (string | number)[][] = [];

    staffData.forEach((item, index) => {
        tableRows.push([index + 1, item.label, item.value]);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [18, 181, 229] },
    });

    doc.save('relatorio_ranking_equipe.pdf');
  };
  
  const handleDownloadSalesMapPdf = () => {
    const doc = new jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Vendas por Modelo', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Data de Geração: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    const tableColumn = ["Posição", "Modelo", "Nº de Vendas"];
    const tableRows: (string | number)[][] = [];

    salesMapData.forEach((item, index) => {
        tableRows.push([index + 1, item.label, item.value]);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [18, 181, 229] },
    });

    doc.save('relatorio_vendas_modelo.pdf');
  };

  const chartData = useMemo(() => {
    switch (view) {
      case 'visits':
        return visitsData;
      case 'staff':
        return staffData;
      case 'occurrences':
      default:
        return occurrencesData;
    }
  }, [view, visitsData, occurrencesData, staffData]);

  const chartTitle = useMemo(() => {
    switch (view) {
      case 'visits':
        return 'Ranking de Visitas por Estande';
      case 'staff':
        return 'Ranking por Equipe';
      case 'salesByCompany':
        return 'Ranking de Vendas por Empresa';
      case 'salesBySeller':
        return 'Ranking de Vendas por Vendedor';
      case 'salesMap':
        return 'Ranking de Vendas por Modelo';
      case 'occurrences':
      default:
        return 'Ranking de Principais Ocorrências';
    }
  }, [view]);

  const maxValue = Math.max(...chartData.map(d => d.value), 0);
  const maxSalesCompanyValue = Math.max(...rankedCompaniesBySales.map(c => c.salesCount), 0);

  if (loading) return <LoadingSpinner />;
  
  const getButtonClass = (buttonView: 'visits' | 'occurrences' | 'staff' | 'salesByCompany' | 'salesBySeller' | 'salesMap') => {
      return view === buttonView 
          ? 'bg-primary text-black' 
          : 'bg-secondary hover:bg-secondary-hover text-text';
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-md">
      <h2 className="text-3xl font-bold mb-4">Ranking</h2>
      
      <div className="flex flex-wrap justify-center sm:justify-start gap-2 mb-6 border-b border-border pb-4">
        <Button onClick={() => setView('visits')} className={getButtonClass('visits')}>
          Visitas por Estande
        </Button>
        <Button onClick={() => setView('occurrences')} className={getButtonClass('occurrences')}>
          Principais Ocorrências
        </Button>
        <Button onClick={() => setView('staff')} className={getButtonClass('staff')}>
          Ranking por Equipe
        </Button>
        <Button onClick={() => setView('salesByCompany')} className={getButtonClass('salesByCompany')}>
          Vendas por Empresa
        </Button>
        <Button onClick={() => setView('salesBySeller')} className={getButtonClass('salesBySeller')}>
          Vendas por Vendedor
        </Button>
        <Button onClick={() => setView('salesMap')} className={getButtonClass('salesMap')}>
          Vendas por Modelo
        </Button>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-primary">{chartTitle}</h3>
          {view === 'occurrences' && chartData.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => handleDownloadOccurrencesPdf(occurrencesData.map(o => o.label))}
              className="text-sm py-1 px-3 flex items-center"
            >
              <DownloadIcon />
              Download Todas
            </Button>
          )}
          {view === 'visits' && chartData.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleDownloadVisitsPdf}
              className="text-sm py-1 px-3 flex items-center"
            >
              <DownloadIcon />
              Download PDF
            </Button>
          )}
          {view === 'staff' && chartData.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleDownloadStaffPdf}
              className="text-sm py-1 px-3 flex items-center"
            >
              <DownloadIcon />
              Download PDF
            </Button>
          )}
          {view === 'salesMap' && salesMapData.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleDownloadSalesMapPdf}
              className="text-sm py-1 px-3 flex items-center"
            >
              <DownloadIcon />
              Download PDF
            </Button>
          )}
        </div>

        {(view === 'visits' || view === 'occurrences' || view === 'staff') && (
            chartData.length > 0 ? (
                <div className="space-y-2">
                    {chartData.map((item, index) => {
                        const isClickable = view === 'occurrences';
                        const isSelected = selectedOccurrence === item.label;
                        const WrapperComponent = isClickable ? 'button' : 'div';
                        const wrapperProps = isClickable ? { 
                            onClick: () => setSelectedOccurrence(prev => prev === item.label ? null : item.label),
                            className: `w-full text-left p-0 rounded-lg transition-colors ${isSelected ? 'bg-secondary' : 'hover:bg-secondary/50'}`
                        } : {
                            className: "w-full"
                        };

                        return (
                            <WrapperComponent key={index} {...wrapperProps}>
                                <div className={`flex items-center gap-4 group w-full p-2`}>
                                    <span className="text-right font-semibold text-text-secondary w-10">{index + 1}º</span>
                                    {view === 'visits' && (
                                        <img 
                                            src={item.logoUrl || 'https://via.placeholder.com/150?text=Logo'} 
                                            alt={`${item.label} logo`} 
                                            className="w-8 h-8 rounded-full object-contain bg-white flex-shrink-0"
                                        />
                                    )}
                                    {view === 'staff' && (
                                        <img 
                                            src={item.logoUrl || 'https://via.placeholder.com/150'} 
                                            alt={item.label} 
                                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                        />
                                    )}
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-sm font-medium text-text truncate pr-2" title={item.label}>{item.label}</p>
                                            <div className="flex items-center">
                                                <p className="text-sm font-bold text-primary">{item.value}</p>
                                                {(view === 'visits' || view === 'staff') && index < 3 && <MedalIcon position={index + 1} />}
                                            </div>
                                        </div>
                                        <div className="w-full bg-secondary rounded-full h-4 overflow-hidden">
                                            <div
                                            className="bg-primary h-4 rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </WrapperComponent>
                        );
                    })}
                </div>
            ) : (
            <div className="text-center py-10">
                <p className="text-text-secondary">Nenhum dado para exibir.</p>
            </div>
            )
        )}

        {view === 'salesByCompany' && (
             <div>
                {rankedCompaniesBySales.length > 0 ? (
                    <div className="space-y-2">
                    {rankedCompaniesBySales.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-4 group w-full p-2">
                            <span className="text-right font-semibold text-text-secondary w-10">{index + 1}º</span>
                            <img src={item.logoUrl || 'https://via.placeholder.com/150?text=Logo'} alt={`${item.name} logo`} className="w-8 h-8 rounded-full object-contain bg-white flex-shrink-0"/>
                            <div className="flex-1 overflow-hidden">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm font-medium text-text truncate pr-2" title={item.name}>{item.name}</p>
                                    <div className="flex items-center">
                                        <p className="text-sm font-bold text-primary">{item.salesCount}</p>
                                        {index < 3 && <MedalIcon position={index + 1} />}
                                    </div>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-4 overflow-hidden">
                                    <div className="bg-primary h-4 rounded-full transition-all duration-500 ease-out" style={{ width: `${maxSalesCompanyValue > 0 ? (item.salesCount / maxSalesCompanyValue) * 100 : 0}%` }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                    </div>
                ) : <p className="text-center text-text-secondary py-4">Nenhuma venda registrada no evento.</p>}
            </div>
        )}
        
        {view === 'salesBySeller' && (
            <div>
                <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center mb-4 gap-4">
                    <select
                        value={sellerCompanyFilter}
                        onChange={(e) => setSellerCompanyFilter(e.target.value)}
                        className="w-full sm:w-auto px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">Todas as Empresas</option>
                        {salesData.filter(c => c.salesCount > 0).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                 {rankedSellers.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {rankedSellers.map((seller, index) => (
                        <div key={seller.id} className="flex items-center gap-4 group w-full p-2">
                            <span className="text-right font-semibold text-text-secondary w-10">{index + 1}º</span>
                             <img 
                                src={seller.photoUrl || 'https://via.placeholder.com/150'} 
                                alt={seller.name} 
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                            <div className="flex-1 overflow-hidden">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="truncate pr-2">
                                        <p className="text-sm font-medium text-text" title={seller.name}>{seller.name}</p>
                                        <p className="text-xs text-text-secondary" title={seller.collaboratorCode}>{seller.collaboratorCode}</p>
                                    </div>
                                    <div className="flex items-center">
                                        <p className="text-sm font-bold text-primary">{seller.salesCount}</p>
                                        {index < 3 && <MedalIcon position={index + 1} />}
                                    </div>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-4 overflow-hidden">
                                    <div
                                        className="bg-primary h-4 rounded-full transition-all duration-500 ease-out"
                                        style={{ width: `${maxSellerValue > 0 ? (seller.salesCount / maxSellerValue) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                    </div>
                ) : <p className="text-center text-text-secondary py-4">Nenhuma venda registrada para a seleção atual.</p>}
            </div>
        )}

        {view === 'salesMap' && (
             <div>
                {salesMapData.length > 0 ? (
                    <div className="space-y-2">
                    {salesMapData.map((item, index) => {
                        const maxSalesMapValue = salesMapData[0].value;
                        return (
                            <div key={index} className="flex items-center gap-4 group w-full p-2">
                                <span className="text-right font-semibold text-text-secondary w-10">{index + 1}º</span>
                                <div className="flex-1 overflow-hidden">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-sm font-medium text-text truncate pr-2" title={item.label}>{item.label}</p>
                                    <div className="flex items-center">
                                    <p className="text-sm font-bold text-primary">{item.value}</p>
                                    {index < 3 && <MedalIcon position={index + 1} />}
                                    </div>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-4 overflow-hidden">
                                    <div className="bg-primary h-4 rounded-full transition-all duration-500 ease-out" style={{ width: `${maxSalesMapValue > 0 ? (item.value / maxSalesMapValue) * 100 : 0}%` }}></div>
                                </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                ) : <p className="text-center text-text-secondary py-4">Nenhum dado de vendas por modelo para exibir.</p>}
            </div>
        )}
      </div>

      {view === 'occurrences' && selectedOccurrence && (
        <div className="mt-8 pt-6 border-t border-border animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold">Respostas Detalhadas</h3>
              <Button
                variant="secondary"
                onClick={() => handleDownloadOccurrencesPdf([selectedOccurrence])}
                className="text-sm py-1 px-3 flex items-center"
              >
                <DownloadIcon />
                Download PDF
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {detailedReportsForSelectedOccurrence.map(report => (
                <div key={report.id} className="bg-secondary p-4 rounded-lg border border-border/50">
                    <p className="font-semibold text-text mb-2">{questionMap[report.reportLabel] || report.reportLabel}</p>
                    <div className="flex items-start gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2V7a2 2 0 012-2h4l2-2h2l-2 2z" /></svg>
                        <p className="text-text flex-1">
                            {report.response}
                        </p>
                    </div>

                    <div className="text-xs text-text-secondary border-t border-border/50 mt-3 pt-2 flex flex-wrap justify-between items-center gap-2">
                        <div>
                            <p><strong>Estande:</strong> {companyInfoMap[report.boothCode]?.name || report.boothCode}</p>
                            <p><strong>Equipe:</strong> {report.staffName}</p>
                        </div>
                        <p className="font-medium text-right">{new Date(report.timestamp).toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            ))}
            </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #2C3547;
            border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #AEB8C4;
        }
        @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default RankingView;