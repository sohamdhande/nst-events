import { ChevronDown, Building2 } from 'lucide-react';

export function ContextSwitcher() {
  return (
    <div className="px-4 py-2 mt-2">
      <button 
        type="button" 
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-base focus-visible:outline-none"
        aria-haspopup="listbox"
        aria-expanded="false"
        disabled
        aria-label="Context Switcher (Disabled in V1)"
      >
        <div className="flex items-center">
          <Building2 className="w-4 h-4 mr-2 text-gray-500" aria-hidden="true" />
          <span className="truncate">Main Campus</span>
        </div>
        <ChevronDown className="w-4 h-4 ml-2 text-gray-400" aria-hidden="true" />
      </button>
    </div>
  );
}
