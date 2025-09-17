import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { validateCollaboratorCheckin } from '../services/api';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { triad3LogoFull } from '../assets/logo';

const CollaboratorLoginPage: React.FC = () => {
  const [boothCode, setBoothCode] = useState('');
  const [collaboratorCode, setCollaboratorCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleValidation = async () => {
    if (!boothCode || !collaboratorCode) {
      setError('Ambos os códigos são obrigatórios.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { collaborator, company } = await validateCollaboratorCheckin(boothCode, collaboratorCode);
      sessionStorage.setItem('collaboratorCheckinInfo', JSON.stringify({
        boothCode: boothCode.toUpperCase(),
        companyName: company.name,
        companyId: company.id,
        collaboratorCode: collaborator.collaboratorCode,
        collaboratorPhotoUrl: collaborator.photoUrl,
      }));
      navigate(`/collaborator/${boothCode.toUpperCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-xl shadow-lg">
            <img 
              src={triad3LogoFull} 
              alt="Triad3 Inteligência Digital" 
              className="w-32 h-32 mx-auto mb-4 rounded-full object-cover shadow-[0_0_15px_rgba(18,181,229,0.4)] transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-[0_0_25px_rgba(18,181,229,0.7)]" 
            />
            <h2 className="text-2xl font-bold text-center text-primary">
                Acesso do Colaborador
            </h2>
            <div className="space-y-4">
            <Input 
                id="booth-code"
                label="Código da Empresa"
                value={boothCode}
                onChange={(e) => setBoothCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            />
            <Input 
                id="collaborator-code"
                label="Seu Código de Colaborador"
                value={collaboratorCode}
                onChange={(e) => setCollaboratorCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            />
            {error && <p className="text-red-500 text-center">{error}</p>}
            <Button onClick={handleValidation} disabled={loading} className="w-full">
                {loading ? <LoadingSpinner /> : 'Entrar'}
            </Button>
            </div>
        </div>
        <div className="mt-6 text-center">
            <Link to="/" className="text-sm font-medium text-primary hover:text-blue-400 transition-colors">
                Acesso Equipe
            </Link>
        </div>
    </div>
  );
};

export default CollaboratorLoginPage;