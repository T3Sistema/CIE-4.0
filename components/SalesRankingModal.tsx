import React, { useState, useMemo } from 'react';
import { CompanySalesData } from '../types';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  salesData: CompanySalesData[];
}

const SalesRankingModal: React.FC<Props> = ({ isOpen, onClose, salesData }) => {
    const [sellerCompanyFilter, setSellerCompanyFilter] = useState('all');

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

    const maxSalesCompanyValue = Math.max(...rankedCompaniesBySales.map(c => c.salesCount), 0);

    const isSingleCompanyView = salesData.length === 1;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ranking de Vendas">
            <div className="space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                {/* Ranking por Empresa */}
                {!isSingleCompanyView && (
                    <div>
                        <h3 className="text-xl font-semibold text-primary mb-4">Ranking de Vendas por Empresa</h3>
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

                {/* Ranking por Vendedor */}
                <div className={!isSingleCompanyView ? "pt-8 border-t border-border" : ""}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <h3 className="text-xl font-semibold text-primary">{isSingleCompanyView ? 'Ranking de Vendas da Equipe' : 'Ranking de Vendas por Vendedor'}</h3>
                        {!isSingleCompanyView && (
                            <select
                                value={sellerCompanyFilter}
                                onChange={(e) => setSellerCompanyFilter(e.target.value)}
                                className="w-full sm:w-auto px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="all">Todas as Empresas</option>
                                {salesData.filter(c => c.salesCount > 0).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        )}
                    </div>
                     {rankedSellers.length > 0 ? (
                        <div className="space-y-3">
                        {rankedSellers.map((seller, index) => (
                            <div key={seller.id} className="flex items-center gap-4 p-3 bg-secondary rounded-lg">
                                <span className="text-right font-semibold text-text-secondary w-10">{index + 1}º</span>
                                <img src={seller.photoUrl || 'https://via.placeholder.com/150'} alt={seller.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0"/>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-bold text-text truncate">{seller.name}</p>
                                    <p className="text-sm text-text-secondary truncate">{seller.companyName} / {seller.collaboratorCode}</p>
                                </div>
                                <div className="flex items-center flex-shrink-0">
                                    <p className="text-lg font-bold text-primary">{seller.salesCount}</p>
                                    {index < 3 && <MedalIcon position={index + 1} />}
                                </div>
                            </div>
                        ))}
                        </div>
                    ) : <p className="text-center text-text-secondary py-4">Nenhuma venda registrada para a seleção atual.</p>}
                </div>
            </div>
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
            `}</style>
        </Modal>
    );
};

export default SalesRankingModal;