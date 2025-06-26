import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import labels from '../constants/labels';

const Layout = ({ children }) => {
  const location = useLocation();
  const { language, setLanguage } = useLanguage();
  const t = labels[language] || {};
  const [animateLang, setAnimateLang] = useState(false);

  useEffect(() => {
    setAnimateLang(true);
    const timer = setTimeout(() => setAnimateLang(false), 300);
    return () => clearTimeout(timer);
  }, [language]);

  return (
    <div className="min-h-screen bg-black text-gold px-4 pt-4 pb-6">
      {/* Sticky Header with Logo + Navigation */}
      <div className="sticky top-0 z-50 bg-black pb-2">
        {/* Language Toggle - Top Left */}
        <div className="absolute top-2 left-2 flex flex-col sm:flex-row gap-1 sm:gap-2 z-10">
          <button
            onClick={() => setLanguage('en')}
            className={
              "px-3 py-1 rounded font-semibold text-sm transition duration-200 ease-in-out " +
              (language === 'en'
                ? 'bg-gold text-black'
                : 'border border-gold text-gold hover:bg-gold hover:text-black')
            }
          >
            EN
          </button>
          <button
            onClick={() => setLanguage('sr')}
            className={
              "px-3 py-1 rounded font-semibold text-sm transition duration-200 ease-in-out " +
              (language === 'sr'
                ? 'bg-gold text-black'
                : 'border border-gold text-gold hover:bg-gold hover:text-black')
            }
          >
            SR
          </button>
        </div>

        {/* Logo Centered */}
        <div className="flex flex-col items-center justify-center mt-6 mb-3">
          <img src="/logo-dark.png" alt="Noble Cut Logo" className="mx-auto mb-2 w-28 md:w-40 transition-opacity duration-500 opacity-100" />
        </div>

        {/* Navigation Buttons */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-1">
          <Link
            to="/"
            className={
              "w-40 text-center px-4 py-2 rounded-lg font-bold text-sm sm:text-md transition-all duration-200 relative " +
              (location.pathname === '/'
                ? 'bg-gold text-black'
                : 'text-gold border border-gold hover:bg-gold hover:text-black')
            }
          >
            {t.newOrders || 'New Orders'}
            {location.pathname === '/' && <div className="h-1 w-full bg-gold mt-1 rounded absolute bottom-[-5px] left-0"></div>}
          </Link>
          <Link
            to="/production"
            className={
              "w-40 text-center px-4 py-2 rounded-lg font-bold text-sm sm:text-md transition-all duration-200 relative " +
              (location.pathname === '/production'
                ? 'bg-gold text-black'
                : 'text-gold border border-gold hover:bg-gold hover:text-black')
            }
          >
            {t.ordersInProduction || 'Orders in Production'}
            {location.pathname === '/production' && <div className="h-1 w-full bg-gold mt-1 rounded absolute bottom-[-5px] left-0"></div>}
          </Link>
          <Link
            to="/delivered"
            className={
              "w-40 text-center px-4 py-2 rounded-lg font-bold text-sm sm:text-md transition-all duration-200 relative " +
              (location.pathname === '/delivered'
                ? 'bg-gold text-black'
                : 'text-gold border border-gold hover:bg-gold hover:text-black')
            }
          >
            {t.deliveredOrders || 'Delivered Orders'}
            {location.pathname === '/delivered' && <div className="h-1 w-full bg-gold mt-1 rounded absolute bottom-[-5px] left-0"></div>}
          </Link>
        </div>
      </div>

      {/* Animated language change for mobile */}
      <div className={animateLang ? "transition-opacity duration-300 opacity-100" : ""}>
        {children}
      </div>
    </div>
  );
};

export default Layout;
