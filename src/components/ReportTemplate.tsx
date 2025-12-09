import { forwardRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ReportTemplateProps {
    report: any;
}

export const ReportTemplate = forwardRef<HTMLDivElement, ReportTemplateProps>(
    ({ report }, ref) => {
        if (!report) return null;

        const shortagesByValue = report.results.allShortages
            .sort((a: any, b: any) => a.diffValue - b.diffValue)
            .slice(0, 15);

        const surplusesByValue = report.results.allSurpluses
            .sort((a: any, b: any) => b.diffValue - a.diffValue)
            .slice(0, 15);

        const totalShortageValue = report.results.allShortages.reduce((acc: number, curr: any) => acc + curr.diffValue, 0);
        const totalSurplusValue = report.results.allSurpluses.reduce((acc: number, curr: any) => acc + curr.diffValue, 0);
        const netDifference = totalShortageValue + totalSurplusValue;

        return (
            <div ref={ref} className="bg-white p-8 w-[800px] text-black font-sans">
                {/* Header */}
                <div className="border-b-2 border-primary pb-4 mb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-primary">Reporte de Inventario</h1>
                            <p className="text-sm text-gray-500">Farmaplus Gestión</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-semibold">{report.branch}</h2>
                            <p className="text-gray-600">{report.sector}</p>
                            <p className="text-sm text-gray-500">
                                {format(new Date(report.date), "PPP", { locale: es })}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                        <p className="text-sm text-red-600 font-medium">Total Faltante</p>
                        <p className="text-2xl font-bold text-red-700">
                            ${Math.abs(totalShortageValue).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <p className="text-sm text-green-600 font-medium">Total Sobrante</p>
                        <p className="text-2xl font-bold text-green-700">
                            ${totalSurplusValue.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className={`p-4 rounded-lg border ${netDifference < 0 ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'}`}>
                        <p className={`text-sm font-medium ${netDifference < 0 ? 'text-orange-600' : 'text-blue-600'}`}>Diferencia Neta</p>
                        <p className={`text-2xl font-bold ${netDifference < 0 ? 'text-orange-700' : 'text-blue-700'}`}>
                            ${netDifference.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {/* Tables */}
                <div className="space-y-6">
                    {/* Shortages */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-red-700 border-l-4 border-red-500 pl-2">
                            Top 15 Faltantes (por valor)
                        </h3>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-2 rounded-tl-lg">Producto</th>
                                    <th className="p-2 text-right">Cant.</th>
                                    <th className="p-2 text-right rounded-tr-lg">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {shortagesByValue.map((item: any, index: number) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="p-2 truncate max-w-[250px]">{item.name}</td>
                                        <td className="p-2 text-right font-medium text-red-600">{item.diffQty}</td>
                                        <td className="p-2 text-right font-medium text-red-600">
                                            ${item.diffValue.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Surpluses */}
                    <div>
                        <h3 className="text-lg font-semibold mb-3 text-green-700 border-l-4 border-green-500 pl-2">
                            Top 15 Sobrantes (por valor)
                        </h3>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-2 rounded-tl-lg">Producto</th>
                                    <th className="p-2 text-right">Cant.</th>
                                    <th className="p-2 text-right rounded-tr-lg">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {surplusesByValue.map((item: any, index: number) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="p-2 truncate max-w-[250px]">{item.name}</td>
                                        <td className="p-2 text-right font-medium text-green-600">+{item.diffQty}</td>
                                        <td className="p-2 text-right font-medium text-green-600">
                                            ${item.diffValue.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t text-center text-xs text-gray-400">
                    Generado por Farmaplus PWA - {new Date().toLocaleString()}
                </div>
            </div>
        );
    }
);

ReportTemplate.displayName = "ReportTemplate";
