"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Package } from 'lucide-react';
import { db, Product } from '@/app/_db/db';

interface ProductSearchProps {
  onSelect?: (product: Product) => void;
  onFilter?: (products: Product[]) => void;
  placeholder?: string;
  showResults?: boolean;
  autoFocus?: boolean;
  className?: string;
  filterInStock?: boolean;
}

export default function ProductSearch({
  onSelect,
  onFilter,
  placeholder = "Buscar por nombre, SKU o descripción...",
  showResults = true,
  autoFocus = false,
  className = "",
  filterInStock = false,
}: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search
  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (!term.trim()) {
        setResults([]);
        setIsSearching(false);
        if (onFilter) {
          const allProducts = await db.products.toArray();
          onFilter(filterInStock ? allProducts.filter(p => p.stockQuantity > 0) : allProducts);
        }
        return;
      }

      setIsSearching(true);
      try {
        const lowerTerm = term.toLowerCase();
        
        // Search by name, SKU, or description
        const allProducts = await db.products.toArray();
        const filtered = allProducts.filter(product => {
          const matchesSearch = 
            product.name.toLowerCase().includes(lowerTerm) ||
            product.sku.toLowerCase().includes(lowerTerm) ||
            (product.description && product.description.toLowerCase().includes(lowerTerm));
          
          if (filterInStock) {
            return matchesSearch && product.stockQuantity > 0;
          }
          return matchesSearch;
        });

        setResults(filtered);
        if (onFilter) {
          onFilter(filtered);
        }
      } catch (error) {
        console.error('Error searching products:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [onFilter, filterInStock]
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + K to focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (product: Product) => {
    if (onSelect) {
      onSelect(product);
      setSearchTerm("");
      setResults([]);
      setShowDropdown(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm("");
    setResults([]);
    inputRef.current?.focus();
    if (onFilter) {
      db.products.toArray().then(products => {
        onFilter(filterInStock ? products.filter(p => p.stockQuantity > 0) : products);
      });
    }
  };

  const handleInputFocus = () => {
    if (showResults && searchTerm.trim()) {
      setShowDropdown(true);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (showResults) setShowDropdown(true);
          }}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="block w-full pl-10 pr-20 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors mr-1"
              title="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 border border-gray-200 rounded text-xs font-sans font-medium text-gray-400 bg-gray-50">
            Ctrl+K
          </kbd>
        </div>
      </div>

      {/* Dropdown Results */}
      {showResults && showDropdown && (searchTerm.trim() || results.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white shadow-lg rounded-lg border border-gray-200 max-h-80 overflow-y-auto"
        >
          {isSearching ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full mr-2" />
              Buscando...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p>No se encontraron productos</p>
              <p className="text-sm text-gray-400 mt-1">
                Intenta con otro término de búsqueda
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {results.map((product) => (
                <li
                  key={product.id || product.sku}
                  onClick={() => handleSelect(product)}
                  className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors ${
                    product.stockQuantity <= 0 ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        SKU: <span className="font-mono">{product.sku}</span>
                        {product.description && (
                          <span className="ml-2 text-gray-400">{product.description}</span>
                        )}
                      </p>
                    </div>
                    <div className="ml-4 text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        ${product.priceUsd.toFixed(2)}
                      </p>
                      <p className={`text-xs mt-0.5 ${
                        product.stockQuantity <= 5 ? 'text-red-600 font-medium' : 'text-gray-500'
                      }`}>
                        Stock: {product.stockQuantity}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Results Count (when used for filtering) */}
      {!showResults && results.length > 0 && (
        <div className="mt-2 text-sm text-gray-500">
          {results.length} {results.length === 1 ? 'producto encontrado' : 'productos encontrados'}
        </div>
      )}
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Hook for product search
export function useProductSearch() {
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const search = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return [];
    }

    setIsSearching(true);
    try {
      const lowerTerm = term.toLowerCase();
      const allProducts = await db.products.toArray();
      const filtered = allProducts.filter(product =>
        product.name.toLowerCase().includes(lowerTerm) ||
        product.sku.toLowerCase().includes(lowerTerm) ||
        (product.description && product.description.toLowerCase().includes(lowerTerm))
      );
      setSearchResults(filtered);
      return filtered;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  return { search, searchResults, isSearching };
}
