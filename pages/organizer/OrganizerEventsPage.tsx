
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/LoadingSpinner';

const OrganizerEventsPage: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingSpinner />;
    }

    if (!user || !user.events || user.events.length === 0) {
        return (
            <div className="text-center p-8">
                <h2 className="text-2xl font-bold text-red-500">Nenhum evento encontrado</h2>
                <p className="mt-2 text-text">Você não está associado a nenhum evento ativo.</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-center my-8">Selecione um Evento para Gerenciar</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {user.events.map(event => (
                    <Link 
                        key={event.id} 
                        to={`/admin/event/${event.id}/dashboard`} 
                        className="bg-card rounded-lg shadow-lg flex flex-col overflow-hidden transition-transform transform hover:-translate-y-2 duration-300 group"
                    >
                        <div className="relative">
                            <img 
                                src={event.logoUrl || `https://via.placeholder.com/400x200.png?text=${encodeURIComponent(event.name)}`} 
                                alt={`${event.name} logo`} 
                                className="w-full h-48 object-cover" 
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-40 transition-all duration-300"></div>
                        </div>
                        <div className="p-6 flex-grow flex flex-col">
                            <h3 className="font-bold text-xl text-primary truncate group-hover:underline">{event.name}</h3>
                            <p className="text-sm text-text-secondary mt-1">
                                {new Date(event.date).toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p className="text-text-secondary text-sm mt-2 flex-grow">{event.details}</p>
                            <div className="mt-4 text-center">
                                <span className="inline-block bg-primary text-black font-bold py-2 px-6 rounded-lg group-hover:bg-primary-dark transition-colors">
                                    Gerenciar Evento
                                </span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default OrganizerEventsPage;
