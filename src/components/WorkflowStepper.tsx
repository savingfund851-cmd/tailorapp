import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../i18n';

interface WorkflowStepperProps {
  currentStep: number;
  onAdvance?: () => void;
  orderId: number;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ currentStep, onAdvance, orderId }) => {
  const auth = useContext(AuthContext);
  const lang = auth?.lang || 'en';
  const t = useTranslation(lang);
  
  const steps = [t.cutting, t.sewing, t.finishing, t.qualityCheck, t.finalDelivery];

  return (
    <div className="stepper-container" id={`stepper-${orderId}`}>
      <div className="stepper">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <div key={step} className={`step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
              <div className="step-circle">
                {isCompleted ? '✓' : index + 1}
              </div>
              <div className="step-label">{step}</div>
            </div>
          );
        })}
      </div>
      {onAdvance && currentStep < steps.length && (
        <button className="btn-primary mt-4" onClick={onAdvance} id={`advance-step-${orderId}`}>
          Complete {steps[currentStep]}
        </button>
      )}
    </div>
  );
};
