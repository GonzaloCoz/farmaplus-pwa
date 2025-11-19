import { useState } from 'react';
import productsData from '../data/products.json';

interface Product {
  Codebar: number | string;
  Producto: string;
}

export function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtra los productos basándose en el término de búsqueda.
  // Busca tanto en el nombre del producto como en el código de barras.
  const filteredProducts = productsData.filter((product: Product) => {
    const term = searchTerm.toLowerCase();
    return (
      product.Producto.toLowerCase().includes(term) || String(product.Codebar).includes(term)
    );
  });

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Base de Datos de Productos</h1>

      {/* Input de búsqueda */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nombre o código de barras..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border rounded-md bg-background"
        />
      </div>

      {/* Lista de productos filtrados */}
      <div className="border rounded-lg overflow-hidden">
        {filteredProducts.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-3 font-medium">Código de Barras</th>
                <th className="p-3 font-medium">Producto</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.slice(0, 100).map((product, index) => ( // Mostramos solo los primeros 100 para mejor rendimiento
                <tr key={`${product.Codebar}-${index}`} className="border-t">
                  <td className="p-3 font-mono">{String(product.Codebar)}</td>
                  <td className="p-3">{product.Producto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-center p-6">
            No se encontraron productos con el término "{searchTerm}".
          </p>
        )}
        {filteredProducts.length > 100 && (
          <p className="text-center p-4 text-sm text-muted-foreground">... y {filteredProducts.length - 100} más. Afina tu búsqueda para ver más resultados.</p>
        )}
      </div>
    </div>
  );
}