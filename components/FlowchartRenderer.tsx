
import React from 'react';
import { FlowchartStep, ShapeType } from '../types';

interface Props {
  steps: FlowchartStep[];
  activeStepId: number | null;
  isErrorMode?: boolean;
}

const FlowchartRenderer: React.FC<Props> = ({ steps, activeStepId, isErrorMode }) => {
  const getShapeClasses = (type: ShapeType, id: number) => {
    const isActive = activeStepId === id;
    
    let base = "relative transition-all duration-500 border-2 flex items-center justify-center p-4 text-xs font-bold text-center ";
    
    if (isActive) {
      base += "bg-blue-50 border-blue-500 text-blue-900 scale-110 z-20 shadow-xl active-pulse ";
    } else {
      base += "bg-white border-slate-300 text-slate-700 shadow-sm ";
    }

    switch (type) {
      case 'start':
      case 'end':
        return base + "rounded-full w-28 h-12 border-slate-400";
      case 'process':
        return base + "rounded-none w-36 h-14";
      case 'input':
      case 'output':
        return base + "w-36 h-14 skew-x-[-20deg]";
      case 'decision':
        return base + "w-24 h-24 rotate-45 border-amber-400";
      default:
        return base;
    }
  };

  const renderContent = (step: FlowchartStep) => {
    const contentClasses = step.type === 'decision' ? '-rotate-45 block px-1' : (step.type === 'input' || step.type === 'output' ? 'skew-x-[20deg]' : '');
    return <span className={contentClasses}>{step.text}</span>;
  };

  return (
    <div className="flex flex-col items-center space-y-10 py-12 px-8 min-w-full">
      {steps.map((step, idx) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div className={getShapeClasses(step.type, step.id)}>
              {renderContent(step)}
              {step.type === 'decision' && (
                <div className="absolute -right-12 top-1/2 -translate-y-1/2 -rotate-45 text-[10px] text-slate-400 font-mono">
                  [Yes/No]
                </div>
              )}
            </div>
          </div>
          
          {idx < steps.length - 1 && (
            <div className="relative h-10 w-0.5 bg-slate-300">
              <div className="absolute -bottom-1 -left-[5px] border-t-8 border-t-slate-300 border-x-4 border-x-transparent"></div>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default FlowchartRenderer;
