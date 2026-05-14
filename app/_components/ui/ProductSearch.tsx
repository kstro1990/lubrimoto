"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Package } from 'lucide-react';
import { db, Product } from '@/app/_db/db';
import { TOKENS } from '@/app/_components/_pmTheme';

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
  placeholder = 'Buscar por nombre, SKU o descripción…',
  showResults = true,
  autoFocus = false,
  className = '',
  filterInStock = false,
}: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (!term.trim()) {
        setResults([]);
        setIsSearching(false);
        if (onFilter) {
          const allProducts = await db.products.toArray();
          onFilter(filterInStock ? allProducts.filter((p) => p.stockQuantity > 0) : allProducts);
        }
        return;
      }

      setIsSearching(true);
      try {
        const lowerTerm = term.toLowerCase();
        const allProducts = await db.products.toArray();
        const filtered = allProducts.filter((product) => {
          const matchesSearch =
            product.name.toLowerCase().includes(lowerTerm) ||
            product.sku.toLowerCase().includes(lowerTerm) ||
            (product.description && product.description.toLowerCase().includes(lowerTerm));

          if (filterInStock) return matchesSearch && product.stockQuantity > 0;
          return matchesSearch;
        });

        setResults(filtered);
        if (onFilter) onFilter(filtered);
      } catch (error) {
        console.error('Error searching products:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [onFilter, filterInStock],
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

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
      setSearchTerm('');
      setResults([]);
      setShowDropdown(false);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setResults([]);
    inputRef.current?.focus();
    if (onFilter) {
      db.products.toArray().then((products) => {
        onFilter(filterInStock ? products.filter((p) => p.stockQuantity > 0) : products);
      });
    }
  };

  const handleInputFocus = () => {
    if (showResults && searchTerm.trim()) setShowDropdown(true);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4" style={{ color: TOKENS.slate400 }} />
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
          className="pm-input"
          style={{ paddingLeft: '2.25rem', paddingRight: '5rem', height: '40px' }}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="p-1 rounded transition-colors"
              style={{ color: TOKENS.slate400 }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = TOKENS.slate100)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
              }
              title="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd
            className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider"
            style={{
              background: TOKENS.slate100,
              border: `1px solid ${TOKENS.slate200}`,
              color: TOKENS.slate500,
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {showResults && showDropdown && (searchTerm.trim() || results.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto rounded pm-elevated"
          style={{ background: '#fff', border: `1px solid ${TOKENS.slate200}` }}
        >
          {isSearching ? (
            <div
              className="p-4 text-center text-[13px] flex items-center justify-center gap-2"
              style={{ color: TOKENS.slate500 }}
            >
              <span
                className="inline-block w-3.5 h-3.5 rounded-full animate-spin"
                style={{
                  border: `2px solid ${TOKENS.slate200}`,
                  borderTopColor: TOKENS.orange,
                }}
              />
              Buscando…
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center" style={{ color: TOKENS.slate500 }}>
              <Package
                className="h-8 w-8 mx-auto mb-2"
                style={{ color: TOKENS.slate300 }}
              />
              <p className="text-[13px] font-semibold">No se encontraron productos</p>
              <p className="text-[11px] mt-1" style={{ color: TOKENS.slate400 }}>
                Intenta con otro término de búsqueda
              </p>
            </div>
          ) : (
            <ul>
              {results.map((product) => (
                <li
                  key={product.id || product.sku}
                  onClick={() => handleSelect(product)}
                  className="px-4 py-2.5 cursor-pointer transition-colors"
                  style={{
                    borderBottom: `1px solid ${TOKENS.slate100}`,
                    opacity: product.stockQuantity <= 0 ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLLIElement).style.background = TOKENS.slate50)
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLLIElement).style.background = 'transparent')
                  }
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] font-semibold truncate"
                        style={{ color: TOKENS.charcoal }}
                      >
                        {product.name}
                      </p>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: TOKENS.slate500 }}
                      >
                        <span
                          className="font-mono px-1 py-0.5 rounded"
                          style={{ background: TOKENS.slate100 }}
                        >
                          {product.sku}
                        </span>
                        {product.description && (
                          <span className="ml-2">{product.description}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className="text-[13px] font-bold pm-tnum"
                        style={{ color: TOKENS.charcoal }}
                      >
                        ${product.priceUsd.toFixed(2)}
                      </p>
                      <p
                        className="text-[11px] pm-tnum mt-0.5"
                        style={{
                          color: product.stockQuantity <= 5 ? TOKENS.red : TOKENS.slate500,
                          fontWeight: product.stockQuantity <= 5 ? 700 : 400,
                        }}
                      >
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

      {!showResults && results.length > 0 && (
        <div className="mt-2 text-[12px]" style={{ color: TOKENS.slate500 }}>
          {results.length} {results.length === 1 ? 'producto encontrado' : 'productos encontrados'}
        </div>
      )}
    </div>
  );
}

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

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
      const filtered = allProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(lowerTerm) ||
          product.sku.toLowerCase().includes(lowerTerm) ||
          (product.description && product.description.toLowerCase().includes(lowerTerm)),
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
