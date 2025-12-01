import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faBars, faTimes } from '@fortawesome/free-solid-svg-icons';
import WeatherWidget from './WeatherWidget';

const InstructorHeader = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchInputRef = useRef(null);
  const mobileSearchRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-focus mobile search when opened
  useEffect(() => {
    if (showMobileSearch && mobileSearchRef.current) {
      setTimeout(() => {
        mobileSearchRef.current?.focus();
      }, 100);
    }
  }, [showMobileSearch]);

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
  };

  const clearSearch = (e) => {
    e.stopPropagation();
    setSearch('');
    // Focus the appropriate input based on mobile/desktop
    if (!isMobile && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (isMobile && showMobileSearch && mobileSearchRef.current) {
      mobileSearchRef.current.focus();
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      const q = search.trim();
      if (q) {
        navigate(`/instructor/reports?q=${encodeURIComponent(q)}`);
        if (isMobile) {
          setShowMobileSearch(false);
        }
      }
    } else if (e.key === 'Escape' && isMobile) {
      setShowMobileSearch(false);
    }
  };
  
  return (
    <header className="top-header" style={{
      background: 'linear-gradient(135deg, #0f2c63 45%, #f97316 100%)',
      padding: isMobile ? '18px 20px' : '26px 40px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 6px 24px rgba(0, 0, 0, 0.18)',
      position: 'fixed',
      top: 0,
      left: isMobile ? '0' : '250px',
      right: 0,
      width: isMobile ? '100%' : 'calc(100% - 250px)',
      zIndex: 999,
      boxSizing: 'border-box',
      minHeight: isMobile ? '72px' : '92px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <div style={{ 
        position: 'relative', 
        zIndex: 1, 
        display: 'flex', 
        width: '100%', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        gap: '16px'
      }}>
        <div className="header-left" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0
        }}>
          {/* Mobile Hamburger Menu Button */}
          {isMobile && (
            <button
              onClick={onMenuClick}
              aria-label="Toggle menu"
              style={{
                background: 'rgba(255, 255, 255, 0.18)',
                border: '2px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '12px',
                width: '46px',
                height: '46px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
            >
              <FontAwesomeIcon icon={faBars} style={{ fontSize: '20px' }} />
            </button>
          )}
        </div>

        {/* Desktop Search */}
        {!isMobile && (
          <div className="header-center" style={{
            flex: 1,
            maxWidth: '700px',
            margin: '0 24px',
            transition: 'opacity 0.3s ease'
          }}>
            <div className="search-container" style={{
              position: 'relative',
              width: '100%',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
              <FontAwesomeIcon
                icon={faSearch}
                style={{
                  position: 'absolute',
                  left: '18px',
                  top: '50%',
                  transform: isSearchFocused ? 'translateY(-50%) scale(1.1)' : 'translateY(-50%) scale(1)',
                  color: isSearchFocused ? '#f97316' : '#64748b',
                  fontSize: '16px',
                  zIndex: 2,
                  transition: 'color 0.2s ease, transform 0.2s ease',
                }}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search schedules, instructors, rooms..."
                style={{
                  width: '100%',
                  padding: '15px 50px 15px 52px',
                  border: `2px solid ${isSearchFocused ? 'rgba(249, 115, 22, 0.5)' : 'rgba(255, 255, 255, 0.3)'}`,
                  borderRadius: '14px',
                  fontSize: '15px',
                  background: isSearchFocused ? 'white' : 'rgba(255, 255, 255, 0.96)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: isSearchFocused 
                    ? '0 6px 20px rgba(249, 115, 22, 0.2)' 
                    : '0 3px 12px rgba(0, 0, 0, 0.1)',
                  fontWeight: '500',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
              />
              {search && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(100, 116, 139, 0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b',
                    transition: 'all 0.2s ease',
                    zIndex: 3,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    e.currentTarget.style.color = '#ef4444';
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(100, 116, 139, 0.1)';
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  }}
                >
                  <FontAwesomeIcon icon={faTimes} style={{ fontSize: '12px' }} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Mobile Search Button */}
        {isMobile && !showMobileSearch && (
          <button
            onClick={() => setShowMobileSearch(true)}
            aria-label="Open search"
            style={{
              background: 'rgba(255, 255, 255, 0.18)',
              border: '2px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '12px',
              width: '46px',
              height: '46px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <FontAwesomeIcon icon={faSearch} style={{ fontSize: '18px' }} />
          </button>
        )}

        <div className="header-right" style={{
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '10px' : '16px',
          flexShrink: 0
        }}>
          <WeatherWidget />
          <img
            src="/images/COT-LOGO_T.png"
            alt="COT Logo"
            className="header-logo"
            style={{
              width: isMobile ? '42px' : '58px',
              height: isMobile ? '42px' : '58px',
              objectFit: 'contain',
              borderRadius: '8px',
              padding: '4px',
              opacity: 1,
              transition: 'transform 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
          <img
            src="/images/buksuu.png"
            alt="Buksu Logo"
            className="header-logo"
            style={{
              width: isMobile ? '42px' : '58px',
              height: isMobile ? '42px' : '58px',
              objectFit: 'contain',
              borderRadius: '8px',
              padding: '4px',
              opacity: 1,
              transition: 'transform 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        </div>
      </div>

      {/* Mobile Search Input */}
      {isMobile && showMobileSearch && (
        <div
          className="mobile-search-input"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #0f2c63 0%, #1e40af 50%, #f97316 100%)',
            borderBottom: '3px solid rgba(255, 255, 255, 0.25)',
            display: 'block',
            zIndex: 1000,
            animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <FontAwesomeIcon
                icon={faSearch}
                style={{
                  position: 'absolute',
                  left: '18px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#f97316',
                  fontSize: '16px',
                  zIndex: 2,
                }}
              />
              <input
                ref={mobileSearchRef}
                type="text"
                placeholder="Search schedules, instructors, rooms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                style={{
                  width: '100%',
                  padding: '14px 50px 14px 52px',
                  border: '2px solid rgba(249, 115, 22, 0.5)',
                  borderRadius: '14px',
                  fontSize: '16px',
                  background: 'white',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 6px 20px rgba(249, 115, 22, 0.2)',
                  fontWeight: '500',
                  outline: 'none',
                }}
              />
              {search && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '26px',
                    height: '26px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#ef4444',
                    transition: 'all 0.2s ease',
                    zIndex: 3,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  }}
                >
                  <FontAwesomeIcon icon={faTimes} style={{ fontSize: '12px' }} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowMobileSearch(false)}
              aria-label="Close search"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '10px',
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <FontAwesomeIcon icon={faTimes} style={{ fontSize: '18px' }} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </header>
  );
};

export default InstructorHeader;