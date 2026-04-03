import React from 'react';

type LoadingSpinnerProps = {
  size?: number;
  className?: string;
  label?: string;
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 16, className = '', label = 'Loading' }) => {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border-2 border-slate-200 border-t-indigo-600 animate-spin ${className}`}
      style={{ width: size, height: size }}
      aria-label={label}
      aria-live="polite"
    />
  );
};

export default LoadingSpinner;

