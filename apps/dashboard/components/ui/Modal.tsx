import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-6 transition-opacity"
      role="dialog"
      aria-modal="true"
    >
      <div 
        className="bg-stitch-surface-container-lowest w-full max-w-md border border-stitch-outline-variant flex flex-col max-h-[90vh] shadow-2xl animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between p-6 border-b border-stitch-outline-variant">
          <h2 className="text-2xl font-black text-stitch-on-surface tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
            {title}
          </h2>
          <button 
            onClick={onClose}
            className="text-stitch-secondary hover:text-stitch-on-surface transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
