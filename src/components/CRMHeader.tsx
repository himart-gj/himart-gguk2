import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Settings, 
  RotateCw, 
  UserPlus, 
  Calculator, 
  Layers, 
  CloudOff, 
  Cloud,
  Bell,
  Save,
  ArrowLeft
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
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 sm:py-2.5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand & Live Connection Indicator */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div 
              onClick={() => onSwitchTab('crm')}
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-red-600 flex items-center justify-center shadow flex-shrink-0 cursor-pointer active:scale-95 transition"
            >
              <Building2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 
                  onClick={() => onSwitchTab('crm')}
                  className="text-xs sm:text-base font-black tracking-tight text-white truncate cursor-pointer hover:text-rose-200 transition"
                >
                  하이마트 <span className="text-rose-400">경기광주점</span>
                </h1>
                {currentTab === 'calculator' && activeCustomerName && (
                  <span className="hidden sm:inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 max-w-[120px] truncate">
                    {activeCustomerName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[10px] sm:text-xs">
                {isGasConnected ? (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="flex items-center gap-1 text-emerald-400 font-medium hover:underline"
                    title="구글 시트 연동 설정 열기"
                  >
                    <Cloud className="w-3 h-3 text-emerald-400" />
                    <span className="hidden sm:inline">구글 시트 연동됨</span>
                    <span className="sm:hidden">시트 연동</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="flex items-center gap-1 text-amber-300 font-semibold hover:underline bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30"
                    title="클릭하여 구글 시트 URL을 등록하세요"
                  >
                    <CloudOff className="w-3 h-3 text-amber-400" />
                    <span>로컬 영구보관 모드</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Core Tab Switcher (Visible on md+ screens, centered & prominent) */}
          <div className="hidden md:flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 shadow-inner gap-1">
            <button
              type="button"
              onClick={() => onSwitchTab('crm')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                currentTab === 'crm'
                  ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <span>👥</span>
              <span>고객 CRM / 배송 파이프라인</span>
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab('calculator')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                currentTab === 'calculator'
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <span>🧮</span>
              <span>견적 계산기 (Sheet 1~6)</span>
            </button>
          </div>

          {/* Action Bar (Decluttered, grouped icons) */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {currentTab === 'calculator' ? (
              <>
                {/* Mobile / Compact Input vs Sheet Toggle */}
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button
                    type="button"
                    onClick={() => handleMobileSwitch('input')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                      mobileCalcView === 'input'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    입력
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMobileSwitch('sheet')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                      mobileCalcView === 'sheet'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    견적서
                  </button>
                </div>

                {/* Save Quote Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (typeof (window as any).openSaveModal === 'function') {
                      (window as any).openSaveModal();
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition active:scale-95 ring-1 ring-indigo-400/40"
                  title="현재 작성된 견적을 CRM 고객으로 등록 및 저장"
                >
                  <Save className="w-3.5 h-3.5 text-indigo-200" />
                  <span className="hidden sm:inline">CRM으로 등록</span>
                  <span className="sm:hidden">등록</span>
                </button>

                {/* Return to CRM Button */}
                <button
                  type="button"
                  onClick={() => onSwitchTab('crm')}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold border border-rose-500 transition active:scale-95 shadow-sm"
                  title="고객 CRM 대시보드로 즉시 복귀"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-rose-100" />
                  <span className="hidden sm:inline">CRM으로 복귀</span>
                  <span className="sm:hidden">CRM</span>
                </button>
              </>
            ) : (
              <>
                {/* 🔔 Morning Briefing Notification Bell */}
                {onOpenBriefing && (
                  <button
                    type="button"
                    onClick={onOpenBriefing}
                    className="relative p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 shadow transition active:scale-95 flex items-center gap-1.5"
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
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition active:scale-95 flex items-center gap-1.5"
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
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow transition active:scale-95 flex items-center"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : 'text-slate-300'}`} />
                </button>

                {/* Settings */}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold shadow border border-slate-700 transition active:scale-95 flex items-center"
                  title="설정 및 구글 시트 연동"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Dedicated Core Tab Switcher Row (Always visible, thumb-friendly, perfectly fits all mobile & tablet screens) */}
        <div className="md:hidden grid grid-cols-2 gap-1.5 p-1 bg-slate-800/95 rounded-xl border border-slate-700/90 shadow-inner mt-1.5">
          <button
            type="button"
            onClick={() => onSwitchTab('crm')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-black transition-all ${
              currentTab === 'crm'
                ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/40'
                : 'text-slate-300 hover:text-white bg-slate-800/60'
            }`}
          >
            <span>👥</span>
            <span className="truncate">고객 CRM / 배송</span>
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab('calculator')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-black transition-all ${
              currentTab === 'calculator'
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40'
                : 'text-slate-300 hover:text-white bg-slate-800/60'
            }`}
          >
            <span>🧮</span>
            <span className="truncate">견적 계산기 (Sheet 1~6)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
