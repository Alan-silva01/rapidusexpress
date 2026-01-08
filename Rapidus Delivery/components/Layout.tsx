
import React from 'react';
import { Home, Inbox, User, DollarSign, Map as MapIcon, Users, Bike, Tag } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  role: 'admin' | 'entregador';
  currentView: string;
  onViewChange: (view: any) => void;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, role, currentView, onViewChange, onLogout }) => {
  return (
    <div className="min-h-screen bg-black pb-28 lg:pb-0 lg:pl-64">
      {/* Mobile Nano-Pill Nav - With solid black background area */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-black pt-2 pb-6 px-8">
          <nav className="bottom-nav-pill flex justify-around items-center max-w-[340px] mx-auto shadow-2xl">
            <MobileNavItem active={currentView === 'dashboard'} onClick={() => onViewChange('dashboard')} icon={<Home size={18} strokeWidth={1.5} />} />

            <MobileNavItem active={currentView === 'map'} onClick={() => onViewChange('map')} icon={<MapIcon size={18} strokeWidth={1.5} />} />

            {role === 'admin' && (
              <MobileNavItem active={currentView === 'inbox'} onClick={() => onViewChange('inbox')} icon={<Inbox size={18} strokeWidth={1.5} />} />
            )}

            {role === 'admin' && (
              <MobileNavItem active={currentView === 'self_delivery'} onClick={() => onViewChange('self_delivery')} icon={<Bike size={18} strokeWidth={1.5} />} />
            )}

            {role === 'admin' && (
              <MobileNavItem active={currentView === 'prices'} onClick={() => onViewChange('prices')} icon={<Tag size={18} strokeWidth={1.5} />} />
            )}

            <MobileNavItem active={currentView === 'finance'} onClick={() => onViewChange('finance')} icon={<DollarSign size={18} strokeWidth={1.5} />} />

            <MobileNavItem active={currentView === 'profile'} onClick={() => onViewChange('profile')} icon={<User size={18} strokeWidth={1.5} />} />

          </nav>
        </div>
      </div>

      <main className="max-w-xl mx-auto px-6 py-6 lg:py-10">
        {children}
      </main>
    </div >
  );
};

const MobileNavItem = ({ active, onClick, icon }: any) => (
  <button
    onClick={onClick}
    className={`relative p-3.5 transition-all duration-300 flex flex-col items-center ${active ? 'text-orange-primary' : 'text-gray-600'}`}
  >
    {icon}
    {active && <div className="nav-active-dot" />}
  </button>
);
