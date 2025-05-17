import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

// Predefined color palette
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7f50', '#af19ff', '#ff3d67', '#00b0ff', '#00c49f'];
const MAX_DISPLAY_DATA = 100; // Limit for better performance

export default function PowerBIClone() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('');
  const [chartType, setChartType] = useState('Bar');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const chartTypes = [
    { id: 'Bar', icon: "📊", label: "Bar Chart" },
    { id: 'Line', icon: "📈", label: "Line Chart" },
    { id: 'Pie', icon: "🥧", label: "Pie Chart" }
  ];

  // Memoized processed data for better performance
  const processedData = useMemo(() => {
    if (!data.length || !xAxis || !yAxis) return [];
    
    // Filter and sort data
    return data
      .filter(item => {
        const val = item[yAxis];
        return typeof val === 'number' && !isNaN(val);
      })
      .sort((a, b) => b[yAxis] - a[yAxis]) // Sort by Y-axis descending
      .slice(0, MAX_DISPLAY_DATA);
  }, [data, xAxis, yAxis]);

  // Update axes when data changes
  useEffect(() => {
    if (columns.length > 0) {
      // Set first column as X-axis by default
      setXAxis(columns[0]);
      
      // Find a numeric column for Y-axis
      const numericColumns = columns.filter(col => {
        if (data.length === 0) return false;
        const sampleValue = data[0][col];
        return typeof sampleValue === 'number';
      });
      
      // Prefer columns with "amount", "value", "total", etc. in name
      const preferredYAxis = numericColumns.find(col => 
        col.toLowerCase().match(/amount|value|total|price|cost|sales/)
      ) || numericColumns[0] || '';
      
      setYAxis(preferredYAxis);
    }
  }, [columns, data]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setFileName(file.name);
    setData([]);
    setColumns([]);

    try {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      let jsonData = [];

      if (fileExtension === 'csv') {
        jsonData = await parseCSVFile(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        jsonData = await parseExcelFile(file);
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      if (jsonData.length > 0) {
        setData(jsonData);
        setColumns(Object.keys(jsonData[0]));
      } else {
        setError('No valid data found in file');
      }
    } catch (err) {
      console.error('File processing error:', err);
      setError(`Error processing file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const parseCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (evt) => {
        try {
          const csvString = evt.target?.result;
          if (!csvString) {
            reject(new Error('Failed to read file'));
            return;
          }
          
          const lines = csvString.split('\n').filter(line => line.trim() !== '');
          if (lines.length === 0) {
            reject(new Error('CSV file is empty'));
            return;
          }
          
          const headers = parseCSVLine(lines[0]);
          const result = [];
          
          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const row: Record<string, any> = {};
            
            headers.forEach((header, index) => {
              let value = values[index] || '';
              // Convert to number if possible
              if (value && !isNaN(value)) {
                value = Number(value);
              }
              row[header] = value;
            });
            
            result.push(row);
          }
          
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  };

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (evt) => {
        try {
          const binaryStr = evt.target?.result;
          if (!binaryStr) {
            reject(new Error('Failed to read file'));
            return;
          }
          
          const workbook = XLSX.read(binaryStr, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          // Clean up data - convert strings to numbers where possible
          const cleanedData = jsonData.map(row => {
            const newRow = {};
            Object.entries(row).forEach(([key, value]) => {
              if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
                newRow[key] = Number(value);
              } else {
                newRow[key] = value;
              }
            });
            return newRow;
          });
          
          resolve(cleanedData);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsBinaryString(file);
    });
  };

  // Helper function to parse CSV lines properly (handling quoted fields)
  const parseCSVLine = (line) => {
    const result = [];
    let start = 0;
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === ',' && !inQuotes) {
        result.push(line.substring(start, i).trim().replace(/^"|"$/g, ''));
        start = i + 1;
      }
    }
    
    // Add the last field
    result.push(line.substring(start).trim().replace(/^"|"$/g, ''));
    return result;
  };

  const formatTooltip = (value) => {
    if (typeof value === 'number') {
      // Format number with commas and up to 2 decimal places
      return value.toLocaleString(undefined, { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 2 
      });
    }
    return value;
  };

  const renderChart = () => {
    if (!processedData.length || !xAxis || !yAxis) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400">
            {!data.length ? 'Upload a file to visualize data' : 'Select valid X and Y axes to generate chart'}
          </p>
        </div>
      );
    }

    switch (chartType) {
      case 'Bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis 
                dataKey={xAxis} 
                tick={{ fill: '#ddd' }} 
                axisLine={{ stroke: '#666' }}
              />
              <YAxis 
                tick={{ fill: '#ddd' }} 
                axisLine={{ stroke: '#666' }}
                tickFormatter={formatTooltip}
              />
              <Tooltip 
                formatter={formatTooltip}
                contentStyle={{ backgroundColor: '#333', border: '1px solid #666' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar 
                dataKey={yAxis} 
                fill="#8884d8" 
                name={yAxis} 
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'Line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={processedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis 
                dataKey={xAxis} 
                tick={{ fill: '#ddd' }} 
                axisLine={{ stroke: '#666' }}
              />
              <YAxis 
                tick={{ fill: '#ddd' }} 
                axisLine={{ stroke: '#666' }}
                tickFormatter={formatTooltip}
              />
              <Tooltip 
                formatter={formatTooltip}
                contentStyle={{ backgroundColor: '#333', border: '1px solid #666' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={yAxis} 
                stroke="#82ca9d" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={yAxis}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'Pie':
        // Limit to top 8 values for pie chart to avoid cluttering
        const pieData = processedData.slice(0, 8);
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie 
                data={pieData} 
                dataKey={yAxis} 
                nameKey={xAxis} 
                cx="50%" 
                cy="50%" 
                outerRadius={130} 
                fill="#8884d8" 
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                animationDuration={1000}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={formatTooltip}
                contentStyle={{ backgroundColor: '#333', border: '1px solid #666' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  // Calculate statistics for the selected Y-axis
  const yAxisStats = useMemo(() => {
    if (!yAxis || !data.length) return null;
    
    const numericValues = data
      .map(d => d[yAxis])
      .filter(val => typeof val === 'number' && !isNaN(val));
    
    if (numericValues.length === 0) return null;
    
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const avg = sum / numericValues.length;
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    
    return {
      min,
      max,
      avg,
      count: numericValues.length
    };
  }, [yAxis, data]);

  return (
    <div className="p-4 md:p-6 bg-gray-900 min-h-screen text-white">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Data Visualization Dashboard</h1>
        <p className="text-gray-400 text-sm md:text-base">
          Upload your Excel or CSV files to generate interactive visualizations
        </p>
      </header>

      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-3">
          <label 
            htmlFor="file-upload" 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded cursor-pointer transition-colors whitespace-nowrap"
          >
            <span>📤 Upload File</span>
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {fileName && (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded border border-gray-700 max-w-full">
              <span>📄</span>
              <span className="text-sm truncate max-w-xs">{fileName}</span>
            </div>
          )}
          
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-gray-400">
              <span className="animate-pulse">⏳</span>
              <span>Processing file...</span>
            </div>
          )}
        </div>
        
        {error && (
          <div className="p-3 mb-4 bg-red-900/30 border border-red-800 rounded text-red-300">
            {error}
          </div>
        )}
      </div>

      {data.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="lg:col-span-1 space-y-4 md:space-y-6">
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Chart Settings</h2>
              
              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-gray-400">Chart Type</label>
                <div className="flex flex-wrap gap-2">
                  {chartTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setChartType(type.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded transition-colors text-sm ${
                        chartType === type.id 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                      title={type.label}
                    >
                      <span>{type.icon}</span>
                      <span className="hidden sm:inline">{type.id}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="x-axis" className="block mb-2 text-sm font-medium text-gray-400">
                  X-Axis (Category)
                </label>
                <select
                  id="x-axis"
                  value={xAxis}
                  onChange={(e) => setXAxis(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-sm"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label htmlFor="y-axis" className="block mb-2 text-sm font-medium text-gray-400">
                  Y-Axis (Values)
                </label>
                <select
                  id="y-axis"
                  value={yAxis}
                  onChange={(e) => setYAxis(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-sm"
                >
                  {columns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Data Preview</h3>
                <div className="overflow-auto max-h-64 bg-gray-700 rounded p-2 text-xs">
                  {data.length > 0 && (
                    <table className="min-w-full">
                      <thead>
                        <tr>
                          {columns.slice(0, 3).map(col => (
                            <th key={col} className="p-1 border-b border-gray-600 text-left truncate max-w-xs">{col}</th>
                          ))}
                          {columns.length > 3 && <th className="p-1 border-b border-gray-600 text-left">...</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {data.slice(0, 5).map((row, i) => (
                          <tr key={i}>
                            {columns.slice(0, 3).map(col => (
                              <td key={col} className="p-1 border-b border-gray-600 truncate max-w-xs">
                                {row[col] !== undefined ? String(row[col]).substring(0, 20) : 'N/A'}
                              </td>
                            ))}
                            {columns.length > 3 && <td className="p-1 border-b border-gray-600">...</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Data Summary</h2>
              <div className="text-sm text-gray-300 space-y-1">
                <p><strong>Total Rows:</strong> {data.length}</p>
                <p><strong>Columns:</strong> {columns.join(', ')}</p>
                
                {yAxisStats && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="font-medium">Statistics for {yAxis}:</p>
                    <p><strong>Count:</strong> {yAxisStats.count}</p>
                    <p><strong>Min:</strong> {formatTooltip(yAxisStats.min)}</p>
                    <p><strong>Max:</strong> {formatTooltip(yAxisStats.max)}</p>
                    <p><strong>Average:</strong> {formatTooltip(yAxisStats.avg)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-3">
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 md:mb-4 gap-2">
                <h2 className="text-lg md:text-xl font-semibold">
                  {chartType} Chart 
                  {xAxis && yAxis && (
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      ({yAxis} by {xAxis})
                    </span>
                  )}
                </h2>
                <div className="text-sm text-gray-400">
                  Showing {processedData.length} of {data.length} rows
                </div>
              </div>
              <div className="chart-container">
                {renderChart()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-semibold mb-2">No Data Loaded</h2>
          <p className="text-gray-400 mb-4">Upload an Excel or CSV file to begin visualization</p>
          <label 
            htmlFor="file-upload" 
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded cursor-pointer transition-colors"
          >
            <span>📤 Upload File</span>
          </label>
        </div>
      )}
    </div>
  );
}