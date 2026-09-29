import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  RotateCw, 
  UserPlus, 
  Calculator, 
  Layers, 
  CloudOff, 
  Cloud,
  Bell,
  Save,
  ArrowLeft,
  Sparkles
} from 'lucide-react';

interface CRMHeaderProps {
  currentTab: 'crm' | 'calculator';
  onSwitchTab: (tab: 'crm' | 'calculator') => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  onOpenNewCustomer: () => void;
  onOpenQuotePicker?: () => void;
  onOpenBriefing?: () => void;
  urgentCount?: number;
  isRefreshing: boolean;
  isGasConnected: boolean;
}

export const CRMHeader: React.FC<CRMHeaderProps> = ({
  currentTab,
  onSwitchTab,
  onOpenSettings,
  onRefresh,
  onOpenNewCustomer,
  onOpenBriefing,
  urgentCount = 0,
  isRefreshing,
  isGasConnected,
}) => {
  const [mobileCalcView, setMobileCalcView] = useState<'input' | 'sheet'>('input');
  const [activeCustomerName, setActiveCustomerName] = useState<string | null>(null);

  // Poll active customer name for calculator header display
  useEffect(() => {
    const updateActiveCustomer = () => {
      const name = (window as any).currentActiveCustomerName || 
        (document.getElementById('i-name') as HTMLInputElement | null)?.value;
      setActiveCustomerName(name ? name.trim() : null);
    };

    const interval = setInterval(updateActiveCustomer, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleMobileSwitch = (view: 'input' | 'sheet') => {
    setMobileCalcView(view);
    if (typeof (window as any).setMobileView === 'function') {
      (window as any).setMobileView(view, false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/98 backdrop-blur-md text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-2.5">
        <div className="flex items-center justify-between gap-1.5 sm:gap-3">
          
          {/* 1. Left: Brand & Indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div 
              onClick={() => onSwitchTab('crm')}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden shadow-md flex-shrink-0 cursor-pointer active:scale-95 transition border border-amber-400/40 group bg-slate-950"
              title="국지CRM (롯데하이마트 경기광주점)"
            >
              <img 
                src="./pwa-192x192.png" 
                alt="국지CRM 엠블럼" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>

            <div className="hidden min-[480px]:block">
              <div className="flex items-center gap-1.5">
                <h1 
                  onClick={() => onSwitchTab('crm')}
                  className="text-xs sm:text-sm font-black tracking-tight text-white cursor-pointer hover:text-rose-200 transition whitespace-nowrap flex items-center gap-1"
                >
                  <span>국지</span>
                  <span className="text-rose-400 bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20 text-[11px] sm:text-xs">CRM</span>
                </h1>
                <span className="text-[9px] text-slate-400 font-medium px-1.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 hidden sm:inline">
                  경기광주점
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                {isGasConnected ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="hidden sm:inline">시트 연동</span>
                  </span>
                ) : (
                  <span className="text-amber-400 font-medium flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span className="hidden sm:inline">로컬 보관</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Center: Core CRM <-> Calculator Navigation Tabs (ALWAYS visible, highly prominent) */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-2xl border border-slate-700/70 shadow-inner gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => onSwitchTab('crm')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                currentTab === 'crm'
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-950/40 ring-1 ring-rose-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              title="고객 CRM / 배송 파이프라인 관리 화면으로 이동"
            >
              <span>👥</span>
              <span className="hidden min-[380px]:inline">고객 CRM</span>
              <span className="min-[380px]:hidden">CRM</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab('calculator')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                currentTab === 'calculator'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-950/40 ring-1 ring-indigo-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              title="견적 계산기 (Sheet 1~6) 화면으로 이동"
            >
              <span>🧮</span>
              <span className="hidden min-[380px]:inline">견적 계산기</span>
              <span className="min-[380px]:hidden">견적서</span>
            </button>
          </div>

          {/* 3. Right: Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {currentTab === 'calculator' ? (
              <>
                {/* Mobile Input vs Sheet View Toggle (Shown on smaller screens) */}
                <div className="xl:hidden flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleMobileSwitch('input')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      mobileCalcView === 'input'
                        ? 'bg-slate-950 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="견적 입력 폼 보기"
                  >
                    입력
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMobileSwitch('sheet')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      mobileCalcView === 'sheet'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="고객용 견적서 보기"
                  >
                    견적서
                  </button>
                </div>

                {/* Save Quote to CRM */}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof (window as any).openSaveModal === 'function') {
                      (window as any).openSaveModal();
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition active:scale-95 ring-1 ring-indigo-400/40 cursor-pointer"
                  title="현재 작성된 견적을 CRM 고객으로 등록 및 저장"
                >
                  <Save className="w-3.5 h-3.5 text-indigo-200" />
                  <span className="hidden sm:inline">CRM 등록</span>
                  <span className="sm:hidden">저장</span>
                </button>

                {/* Settings */}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold shadow border border-slate-700 transition active:scale-95 flex items-center cursor-pointer"
                  title="설정"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                {/* Morning Briefing Notification Bell */}
                {onOpenBriefing && (
                  <button
                    type="button"
                    onClick={onOpenBriefing}
                    className="relative p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 shadow transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                    title="오늘의 영업·배송 알림 브리핑"
                  >
                    <Bell className={`w-3.5 h-3.5 ${urgentCount > 0 ? 'text-amber-400' : 'text-slate-300'}`} />
                    <span className="hidden md:inline">브리핑</span>
                    {urgentCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs">
                        {urgentCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Add New Customer */}
                <button
                  type="button"
                  onClick={onOpenNewCustomer}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition active:scale-95 flex items-center gap-1 cursor-pointer"
                  title="신규 고객 등록"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">신규 등록</span>
                </button>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  title="새로고침"
                  className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow transition active:scale-95 flex items-center cursor-pointer"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : 'text-slate-300'}`} />
                </button>

                {/* Settings */}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold shadow border border-slate-700 transition active:scale-95 flex items-center cursor-pointer"
                  title="설정 및 구글 시트 연동"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
