
import React, { useState, useRef, useEffect } from 'react';
import { parseFlowchart, runSimulation } from './services/geminiService';
import { AppState } from './types';
import FlowchartRenderer from './components/FlowchartRenderer';

// Fix: Correctly define the AIStudio interface to avoid conflict with existing global declarations.
// Use 'var' inside 'declare global' to add aistudio to the global scope (including window) 
// without conflicting with potential existing internal Window property modifiers.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  var aistudio: AIStudio;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState & { quotaExhausted: boolean }>({
    description: '',
    image: null,
    inputs: {},
    isAnalyzing: false,
    isSimulating: false,
    parsedData: null,
    simulationData: null,
    currentStepIndex: -1,
    showResults: false,
    errorMessage: null,
    mode: 'text',
    quotaExhausted: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          await window.aistudio.hasSelectedApiKey();
        }
      } catch (err) {
        console.error("Failed to check API key status:", err);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    try {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        setState(prev => ({ ...prev, quotaExhausted: false, errorMessage: null }));
      }
    } catch (err) {
      console.error("Failed to open key selector:", err);
    }
  };

  const handleError = (err: any) => {
    const errorMessage = err?.message || String(err);
    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
      setState(prev => ({ 
        ...prev, 
        quotaExhausted: true, 
        errorMessage: "The free quota for this lab is currently exhausted. Please select your own API key to continue." 
      }));
    } else if (errorMessage.includes("Requested entity was not found")) {
       setState(prev => ({ 
        ...prev, 
        errorMessage: "API key session expired. Please re-select your key." 
      }));
      handleSelectKey();
    } else {
      setState(prev => ({ ...prev, errorMessage: "An error occurred. Please try again." }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setState(prev => ({ 
          ...prev, 
          image: reader.result as string, 
          mode: 'image' 
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleParse = async () => {
    if (state.mode === 'text' && !state.description.trim()) return;
    if (state.mode === 'image' && !state.image) return;
    
    setState(prev => ({ ...prev, isAnalyzing: true, errorMessage: null, parsedData: null, simulationData: null }));
    try {
      const result = await parseFlowchart(state.description, state.image || undefined);
      const initialInputs = (result.variables || []).reduce((acc, curr) => ({ ...acc, [curr]: '' }), {});
      setState(prev => ({ 
        ...prev, 
        parsedData: result, 
        inputs: initialInputs,
        isAnalyzing: false 
      }));
    } catch (err) {
      setState(prev => ({ ...prev, isAnalyzing: false }));
      handleError(err);
    }
  };

  const handleSimulate = async () => {
    if (!state.parsedData) return;
    const allFilled = Object.values(state.inputs || {}).every(v => v !== '');
    if (!allFilled) {
      setState(prev => ({ ...prev, errorMessage: "Please provide values for all input variables." }));
      return;
    }

    setState(prev => ({ ...prev, isSimulating: true, errorMessage: null, currentStepIndex: -1, showResults: false }));
    try {
      const result = await runSimulation(
        state.description, 
        state.inputs, 
        state.parsedData.digital_flowchart,
        state.image || undefined
      );
      setState(prev => ({ 
        ...prev, 
        simulationData: result, 
        isSimulating: false,
        currentStepIndex: 0 
      }));
    } catch (err) {
      setState(prev => ({ ...prev, isSimulating: false }));
      handleError(err);
    }
  };

  const goToNextStep = () => {
    if (!state.simulationData || !state.simulationData.dry_run) return;
    const nextIdx = state.currentStepIndex + 1;
    if (nextIdx >= state.simulationData.dry_run.length) {
      setState(prev => ({ ...prev, showResults: true }));
    } else {
      setState(prev => ({ ...prev, currentStepIndex: nextIdx }));
    }
  };

  const currentDryStep = state.simulationData && 
    state.simulationData.dry_run && 
    state.currentStepIndex >= 0 && 
    state.currentStepIndex < state.simulationData.dry_run.length
    ? state.simulationData.dry_run[state.currentStepIndex] 
    : null;

  const previousDryStep = state.simulationData && 
    state.currentStepIndex > 0 && 
    state.simulationData.dry_run[state.currentStepIndex - 1]
    ? state.simulationData.dry_run[state.currentStepIndex - 1]
    : null;

  const getGrade = (score: number) => {
    if (score >= 90) return { label: 'A', color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-500' };
    if (score >= 80) return { label: 'B', color: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-500' };
    if (score >= 70) return { label: 'C', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500' };
    return { label: 'F', color: 'text-rose-500', bg: 'bg-rose-500', border: 'border-rose-500' };
  };

  const reset = () => {
    setState({
      description: '',
      image: null,
      inputs: {},
      isAnalyzing: false,
      isSimulating: false,
      parsedData: null,
      simulationData: null,
      currentStepIndex: -1,
      showResults: false,
      errorMessage: null,
      mode: 'text',
      quotaExhausted: false,
    });
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-sans">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center text-white shadow-lg">
            <i className="fa-solid fa-code-branch"></i>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">FlowLab AI</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Algorithm dry-run laboratory</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleSelectKey}
            className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition border border-indigo-100"
          >
            <i className="fa-solid fa-key mr-2"></i> API Key
          </button>
          <button onClick={reset} className="text-sm font-bold text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-lg transition">
            <i className="fa-solid fa-rotate-left mr-2"></i> New Lab
          </button>
        </div>
      </nav>

      {state.quotaExhausted && (
        <div className="bg-amber-600 text-white px-6 py-3 flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 text-sm font-bold">
            <i className="fa-solid fa-triangle-exclamation text-lg"></i>
            <span>Quota Exceeded: The shared API quota is full. Please use your own paid API key to continue exploring.</span>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] uppercase font-black tracking-widest underline opacity-80 hover:opacity-100"
            >
              Billing Docs
            </a>
            <button 
              onClick={handleSelectKey}
              className="bg-white text-amber-700 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-50 transition"
            >
              Select Key
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-10">
        
        {/* Sidebar: Config & Variables */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white rounded-3xl p-8 shadow-xl border border-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">1</span>
                Flowchart Definition
              </h2>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setState(prev => ({ ...prev, mode: 'text' }))}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition ${state.mode === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >Text</button>
                <button 
                  onClick={() => setState(prev => ({ ...prev, mode: 'image' }))}
                  className={`px-4 py-2 text-xs font-bold rounded-md transition ${state.mode === 'image' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >Image</button>
              </div>
            </div>

            {state.mode === 'text' ? (
              <textarea 
                className="w-full h-40 p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition resize-none placeholder:text-slate-300 text-black font-semibold"
                placeholder="Paste algorithm text or pseudocode..."
                value={state.description}
                onChange={(e) => setState(prev => ({ ...prev, description: e.target.value }))}
              />
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 hover:border-indigo-300 transition group overflow-hidden"
              >
                {state.image ? (
                  <img src={state.image} alt="Upload" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <i className="fa-solid fa-camera-retro text-3xl text-slate-300 group-hover:text-indigo-400 mb-2 transition"></i>
                    <p className="text-xs font-bold text-slate-400">Upload hand-drawn logic</p>
                  </>
                )}
                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
              </div>
            )}

            <button 
              onClick={handleParse}
              disabled={state.isAnalyzing}
              className={`mt-6 w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 ${
                state.isAnalyzing ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-black active:scale-95 shadow-lg'
              }`}
            >
              {state.isAnalyzing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
              {state.isAnalyzing ? 'Analyzing...' : 'Identify Variables'}
            </button>
          </section>

          {state.parsedData && state.parsedData.variables && (
            <section className="bg-white rounded-3xl p-8 shadow-xl border border-white animate-in slide-in-from-bottom-6 duration-500">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm">2</span>
                Variable Tracker
              </h2>
              <div className="space-y-4">
                {state.parsedData.variables.map(varName => {
                  const displayValue = (currentDryStep?.variable_state && currentDryStep.variable_state[varName] !== undefined)
                    ? currentDryStep.variable_state[varName]
                    : state.inputs[varName];

                  return (
                    <div key={varName} className="relative">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-2 ml-1">{varName}</label>
                      <input 
                        type="text"
                        className={`w-full px-5 py-3 border-2 rounded-xl outline-none transition font-mono text-sm text-black font-bold shadow-sm ${
                          currentDryStep ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 focus:border-purple-400'
                        }`}
                        value={displayValue || ''}
                        disabled={!!state.simulationData}
                        onChange={(e) => setState(prev => ({ ...prev, inputs: { ...prev.inputs, [varName]: e.target.value } }))}
                        placeholder={`Enter initial ${varName}...`}
                      />
                      {currentDryStep?.variable_state && currentDryStep.variable_state[varName] !== undefined && (
                        <div className="absolute right-3 bottom-3 text-[10px] font-black text-indigo-400 uppercase tracking-tighter">
                          Live Value
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!state.simulationData ? (
                <button 
                  onClick={handleSimulate}
                  disabled={state.isSimulating}
                  className="mt-8 w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-purple-100 transition active:scale-95 flex items-center justify-center gap-3"
                >
                  {state.isSimulating ? <i className="fa-solid fa-brain animate-spin"></i> : <i className="fa-solid fa-vials"></i>}
                  {state.isSimulating ? 'Preparing simulation...' : 'Start Dry Run'}
                </button>
              ) : (
                <div className="mt-8 p-6 bg-indigo-900 rounded-2xl border border-indigo-700 shadow-inner">
                   <div className="flex items-center gap-2 mb-2">
                    <i className="fa-solid fa-bullseye text-indigo-400"></i>
                    <span className="text-white font-black text-[10px] uppercase tracking-widest">Expected Result</span>
                  </div>
                  <div className="text-indigo-100 font-mono font-bold text-xl">
                    {JSON.stringify(state.simulationData.expected_output)}
                  </div>
                  <p className="mt-2 text-[10px] text-indigo-400 font-bold italic leading-tight">
                    This is what the algorithm SHOULD produce based on logic.
                  </p>
                </div>
              )}
            </section>
          )}

          {state.errorMessage && (
            <div className={`rounded-2xl p-5 flex gap-4 text-sm border-2 ${state.quotaExhausted ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
              <i className={`fa-solid ${state.quotaExhausted ? 'fa-bolt' : 'fa-circle-exclamation'} mt-1`}></i>
              <div className="flex flex-col gap-2">
                <p className="font-bold">{state.errorMessage}</p>
                {state.quotaExhausted && (
                  <button 
                    onClick={handleSelectKey}
                    className="w-fit px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-amber-700 transition"
                  >
                    Set My Own API Key
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Canvas & Tracer */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          <div className="bg-white rounded-3xl shadow-xl border border-white overflow-hidden flex flex-col min-h-[700px]">
            {/* Toolbar */}
            <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                </div>
                <h3 className="font-black text-slate-700 text-xs uppercase tracking-widest ml-2">Digital Simulation</h3>
              </div>
              
              {state.simulationData && state.simulationData.dry_run && (
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Trace Progress</div>
                    <div className="text-xs font-bold text-indigo-600">
                      Step {state.currentStepIndex + 1} / {state.simulationData.dry_run.length}
                    </div>
                  </div>
                  <button 
                    onClick={goToNextStep}
                    className={`px-12 py-3.5 rounded-2xl font-black text-sm transition flex items-center gap-3 shadow-xl ${
                      state.showResults 
                        ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-100' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95'
                    }`}
                  >
                    {state.currentStepIndex === state.simulationData.dry_run.length - 1 ? (state.showResults ? 'Simulation Verified' : 'Finish Simulation') : 'Execute Next Step'} 
                    <i className={`fa-solid ${state.showResults ? 'fa-check' : 'fa-chevron-right'} text-xs`}></i>
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Flowchart Visual */}
              <div className="flex-1 relative overflow-auto bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] flex items-start justify-center p-12">
                {!state.parsedData ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300 grayscale">
                    <i className="fa-solid fa-microchip text-9xl mb-8 opacity-20"></i>
                    <p className="text-sm font-black uppercase tracking-[0.2em] opacity-30">Waiting for algorithm data...</p>
                  </div>
                ) : (
                  <FlowchartRenderer 
                    steps={state.parsedData.digital_flowchart || []}
                    activeStepId={currentDryStep?.flowchart_step_id ?? null}
                  />
                )}
              </div>

              {/* Variable Inspector Panel */}
              {state.simulationData && (
                <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col">
                  <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                    <span className="text-white font-black text-[10px] tracking-widest uppercase">State Memory</span>
                    <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      EXECUTING
                    </span>
                  </div>
                  
                  <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    {currentDryStep ? (
                      Object.entries(currentDryStep.variable_state || {}).map(([key, val]) => {
                        const prevVal = previousDryStep?.variable_state ? previousDryStep.variable_state[key] : undefined;
                        const hasChanged = prevVal !== undefined && prevVal !== val;

                        return (
                          <div key={key} className="group">
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-slate-400 font-mono text-xs font-bold">{key}</span>
                              {hasChanged && (
                                <span className="text-[9px] text-amber-400 font-black uppercase animate-bounce">Changed!</span>
                              )}
                            </div>
                            <div className={`bg-slate-800 rounded-2xl p-5 border transition-all duration-500 ${
                              hasChanged ? 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.05)]' : 'border-slate-700'
                            }`}>
                              <span className={`font-mono font-bold text-2xl block truncate ${hasChanged ? 'text-amber-400' : 'text-white'}`}>
                                {JSON.stringify(val)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-600 text-xs text-center p-10 opacity-50 italic">
                        Click "Execute Next Step" to step through logic
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-slate-950 border-t border-slate-800">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <span className="text-indigo-400 font-black text-[10px] uppercase">Instruction</span>
                    </div>
                    <p className="text-slate-200 text-[13px] leading-relaxed font-semibold italic">
                      "{String(currentDryStep?.description || "Awaiting execution trigger...")}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detailed Lab Report */}
          {state.showResults && state.simulationData && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-in slide-in-from-bottom-12 duration-700 pb-12">
              {/* Radial Logic Score Chart */}
              <div className="md:col-span-4 bg-white rounded-[32px] p-8 shadow-2xl border border-white flex flex-col items-center justify-center text-center">
                <div className="relative w-44 h-44 mb-6">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" className="stroke-slate-50" strokeWidth="3" />
                    <circle 
                      cx="18" cy="18" r="16" fill="none" 
                      className={(state.simulationData.accuracy_score || 0) > 80 ? 'stroke-emerald-500' : (state.simulationData.accuracy_score || 0) > 50 ? 'stroke-amber-500' : 'stroke-rose-500'} 
                      strokeWidth="3.5" 
                      strokeDasharray={`${state.simulationData.accuracy_score || 0}, 100`} 
                      strokeLinecap="round" 
                      style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-slate-800">{state.simulationData.accuracy_score || 0}%</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Logic Score</span>
                  </div>
                  {/* Grade Badge */}
                  <div className={`absolute -right-2 -top-2 w-14 h-14 rounded-full bg-white shadow-xl border-4 flex items-center justify-center font-black text-2xl animate-in zoom-in-50 duration-500 ${getGrade(state.simulationData.accuracy_score || 0).color} ${getGrade(state.simulationData.accuracy_score || 0).border}`}>
                    {getGrade(state.simulationData.accuracy_score || 0).label}
                  </div>
                </div>
                <h4 className="font-black text-slate-800 text-lg mb-1">Logic Precision Index</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4">Calculation Health: {state.simulationData.accuracy_score > 70 ? 'Optimal' : 'Compromised'}</p>
                <div className={`px-6 py-2.5 rounded-full text-[12px] font-black uppercase tracking-widest border-2 shadow-sm ${
                  state.simulationData.is_correct ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                }`}>
                   <i className={`fa-solid ${state.simulationData.is_correct ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'} mr-2`}></i>
                  {state.simulationData.is_correct ? 'Logic Gained' : 'Logic Lost'}
                </div>
              </div>

              {/* Assessment and Final Answer */}
              <div className="md:col-span-8 bg-white rounded-[32px] p-10 shadow-2xl border border-white flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
                      state.simulationData.is_correct ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                    }`}>
                      <i className={`fa-solid ${state.simulationData.is_correct ? 'fa-square-check' : 'fa-triangle-exclamation'}`}></i>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-2xl tracking-tight">
                        {state.simulationData.is_correct ? 'Successful Validation' : 'Logic Discrepancy Found'}
                      </h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Algorithm Integrity Verification Report</p>
                    </div>
                  </div>
                </div>

                {/* FINAL COMPUTATION HIGHLIGHT - Your output is this... */}
                <div className={`mb-8 p-10 rounded-[40px] text-white shadow-2xl flex items-center justify-between overflow-hidden relative group transition-all duration-700 hover:scale-[1.01] ${
                  state.simulationData.is_correct ? 'bg-gradient-to-br from-emerald-600 to-teal-700 shadow-emerald-100' : 'bg-gradient-to-br from-rose-600 to-pink-700 shadow-rose-100'
                }`}>
                  <div className="relative z-10 flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                      <span className="text-[11px] font-black uppercase tracking-[0.4em] text-white/80">Computed Result</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-lg font-bold opacity-60">Your output is:</span>
                      <h5 className="text-5xl font-mono font-black break-all drop-shadow-md">
                         {JSON.stringify(state.simulationData.actual_output)}
                      </h5>
                    </div>
                    <p className="mt-6 text-sm font-bold bg-white/10 px-4 py-2 rounded-xl w-fit backdrop-blur-sm border border-white/10">
                      {state.simulationData.is_correct 
                        ? 'PERFECT: The logic flow yielded exactly what was hypothesized.' 
                        : 'ERROR: The output diverged from the expected mathematical result.'}
                    </p>
                  </div>
                  <div className="absolute right-[-30px] top-[-30px] opacity-[0.15] group-hover:rotate-12 transition-transform duration-1000 select-none">
                    <i className={`fa-solid ${state.simulationData.is_correct ? 'fa-circle-check' : 'fa-circle-xmark'} text-[220px]`}></i>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="p-7 bg-slate-50 rounded-[32px] border-2 border-slate-100 relative group overflow-hidden">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-3 tracking-widest">Theoretical Target</span>
                    <div className="font-mono font-bold text-2xl text-slate-800">{JSON.stringify(state.simulationData.expected_output)}</div>
                    <i className="fa-solid fa-crosshairs absolute right-6 top-6 text-slate-200 text-3xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
                  </div>
                  <div className={`p-7 rounded-[32px] border-2 relative group overflow-hidden ${
                    state.simulationData.is_correct ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                  }`}>
                    <span className="text-[10px] font-black opacity-50 uppercase block mb-3 tracking-widest">Calculated Output</span>
                    <div className="font-mono font-bold text-2xl">{JSON.stringify(state.simulationData.actual_output)}</div>
                    <i className={`fa-solid ${state.simulationData.is_correct ? 'fa-check' : 'fa-x'} absolute right-6 top-6 text-current text-3xl opacity-10`}></i>
                  </div>
                </div>

                <div className="p-8 bg-slate-900 rounded-[32px] border border-slate-800 relative overflow-hidden flex-1">
                   <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <i className="fa-solid fa-graduation-cap text-indigo-400 text-sm"></i>
                    </div>
                    <span className="text-white font-black text-xs uppercase tracking-widest">CS Instructor's Logic Commentary</span>
                  </div>
                  <p className="text-slate-300 text-[16px] leading-relaxed font-medium italic">
                    "{state.simulationData.is_correct 
                      ? "Flawless execution. Your algorithm's branch pathing and variable state mutations are logically sound and mathematically verifiable."
                      : (state.simulationData.mistake_explanation || "The sequence of logic has been compromised. The computed output fails to align with the expected result set. Trace back to the decision point where the value diverged.")
                    }"
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-10 px-8 text-center text-slate-400 text-[11px] font-bold uppercase tracking-[0.3em]">
        <p>FlowLab Interactive Lab Environment ● Powered by Gemini AI</p>
      </footer>
    </div>
  );
};

export default App;
