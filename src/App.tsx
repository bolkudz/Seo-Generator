import { useState, useMemo } from 'react';
import Markdown from 'react-markdown';
import { Loader2, Search, Send, RefreshCw, FileText, Image as ImageIcon, UploadCloud, Moon, Sun, Sparkles } from 'lucide-react';

export default function App() {
  const [formData, setFormData] = useState({
    topikUtama: '',
    targetAudience: '',
    tujuanArtikel: '',
    toneBrand: '',
    produkJasa: '',
    jumlahKata: '',
    negaraBahasa: 'Indonesia/Bahasa Indonesia',
    kompetitor: '',
    urlInternal: '',
    sumberWajib: '',
    batasanKlaim: '',
  });

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [activeTab, setActiveTab] = useState<string>('Overview');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isAutoFilling, setIsAutoFilling] = useState(false);


  // Alt Text Generator states
  const [altImageBase64, setAltImageBase64] = useState<string>('');
  const [altImagePreview, setAltImagePreview] = useState<string>('');
  const [altContext, setAltContext] = useState<string>('');
  const [altResult, setAltResult] = useState<string>('');
  const [altLoading, setAltLoading] = useState<boolean>(false);
  const [altError, setAltError] = useState<string>('');

  const parsedSections = useMemo(() => {
    if (!result) return [];

    const tabsDef = [
      { id: 'Brief', regex: /^#{1,4}\s*(?:\d+\.\s*)?(Brief)/i },
      { id: 'Outline', regex: /^#{1,4}\s*(?:\d+\.\s*)?(Outline)/i },
      { id: 'Article', regex: /^#{1,4}\s*(?:\d+\.\s*)?(Article|Full Article)/i },
      { id: 'AEO', regex: /^#{1,4}\s*(?:\d+\.\s*)?(AEO)/i },
      { id: 'GEO', regex: /^#{1,4}\s*(?:\d+\.\s*)?(GEO)/i },
      { id: 'Metadata', regex: /^#{1,4}\s*(?:\d+\.\s*)?(Metadata|SEO Metadata)/i },
      { id: 'Schema', regex: /^#{1,4}\s*(?:\d+\.\s*)?(Schema)/i },
      { id: 'Plagiarism', regex: /^#{1,4}\s*(?:\d+\.\s*)?(Plagiarism|Originality)/i },
      { id: 'Semantic', regex: /^#{1,4}\s*(?:\d+\.\s*)?(Semantic|NLP)/i },
      { id: 'QA Checklist', regex: /^#{1,4}\s*(?:\d+\.\s*)?(QA Checklist|QA|Checklist)/i },
    ];

    let currentTab = 'Overview';
    const contentMap: Record<string, string> = {};

    const lines = result.split('\n');
    for (const line of lines) {
       let matchedTab = null;
       for (const tab of tabsDef) {
          if (tab.regex.test(line.trim())) {
             matchedTab = tab.id;
             break;
          }
       }

       if (matchedTab) {
          currentTab = matchedTab;
       }

       if (!contentMap[currentTab]) {
          contentMap[currentTab] = '';
       }
       contentMap[currentTab] += line + '\n';
    }

    const sections = [];
    if (contentMap['Overview'] && contentMap['Overview'].trim().length > 0) {
       // Only add Overview if it's the only tab, or if it has substantial introductory content
       if (Object.keys(contentMap).length === 1 || contentMap['Overview'].trim().length > 50) {
           sections.push({ id: 'Overview', title: 'Overview', content: contentMap['Overview'] });
       }
    }

    for (const tab of tabsDef) {
       if (contentMap[tab.id] && contentMap[tab.id].trim().length > 0) {
           sections.push({ id: tab.id, title: tab.id, content: contentMap[tab.id] });
       }
    }

    return sections;
  }, [result]);

  const displayedContent = parsedSections.find(s => s.id === activeTab)?.content || parsedSections[0]?.content || '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topikUtama) {
      setError('Topik Utama wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');
    setResult('');
    setActiveTab('Overview');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Terjadi kesalahan saat memproses permintaan.');
      }

      if (!response.body) throw new Error('Response body is missing.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        while (buffer.includes('\n\n')) {
          const index = buffer.indexOf('\n\n');
          const chunk = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);

          if (chunk === 'data: [DONE]') return;
          if (chunk.startsWith('data: ')) {
            try {
              const data = JSON.parse(chunk.slice(6));
              if (data.text) {
                setResult((prev) => prev + data.text);
              }
            } catch (err) {
              console.error('Error parsing streaming chunk', err);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan yang tidak diketahui.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPrompt.trim() || !result) return;
    
    setIsEditing(true);
    setError('');
    const oldResult = result;
    setResult('');
    
    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: oldResult, prompt: editPrompt }),
      });

      if (!response.ok) {
        setResult(oldResult);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Terjadi kesalahan saat memproses editan.');
      }

      if (!response.body) throw new Error('Response body is missing.');

      setEditPrompt('');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        while (buffer.includes('\n\n')) {
          const index = buffer.indexOf('\n\n');
          const chunk = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);

          if (chunk === 'data: [DONE]') return;
          if (chunk.startsWith('data: ')) {
            try {
              const data = JSON.parse(chunk.slice(6));
              if (data.text) {
                setResult((prev) => prev + data.text);
              }
            } catch (err) {
              console.error('Error parsing streaming chunk', err);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan yang tidak diketahui.');
      setResult(oldResult);
    } finally {
      setIsEditing(false);
    }
  };

  const handleAutoFill = async () => {
    if (!formData.topikUtama) {
      setError('Topik Utama wajib diisi untuk melakukan Auto Fill.');
      return;
    }

    setIsAutoFilling(true);
    setError('');

    try {
      const response = await fetch('/api/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topikUtama: formData.topikUtama }),
      });

      if (!response.ok) {
        throw new Error('Gagal melakukan autofill.');
      }

      const data = await response.json();
      setFormData(prev => ({
        ...prev,
        ...data,
      }));
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleAltImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setAltError('Ukuran gambar maksimal 5MB.');
        return;
      }
      setAltError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setAltImagePreview(reader.result as string);
        setAltImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAltGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!altImageBase64) {
      setAltError('Gambar belum dipilih.');
      return;
    }
    setAltLoading(true);
    setAltResult('');
    setAltError('');
    try {
      const response = await fetch('/api/generate-alt-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: altImageBase64, context: altContext }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan.');
      }
      setAltResult(data.altText);
    } catch(err: any) {
      setAltError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setAltLoading(false);
    }
  };

  return (
    <div className={isDarkMode ? 'dark' : ''}>
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-sans p-4 md:p-6 flex flex-col overflow-x-hidden">
      <div className="max-w-[1400px] w-full mx-auto space-y-6 flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0 bg-white/30 dark:bg-slate-900/30 px-4 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-0.5">Alfa Dinamis</p>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white uppercase flex items-center gap-2">
                SEO Content Generator <span className="text-slate-500 dark:text-slate-500 font-normal text-sm">v4.2</span>
              </h1>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-bold tracking-widest">Protocol</span>
            <span className="text-xs font-mono text-indigo-400 italic">2026-GEO-ST</span>
            <button onClick={() => setIsDarkMode(!isDarkMode)} type="button" className="mt-2 text-xs flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              {isDarkMode ? <Sun className="w-4 h-4 text-emerald-500" /> : <Moon className="w-4 h-4 text-emerald-600" />}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
          {/* Input Form Setup */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> PARAMETER KONTEN
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Topik Utama <span className="text-indigo-500">*</span></label>
                  <input
                    type="text"
                    name="topikUtama"
                    value={formData.topikUtama}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors mb-2"
                    placeholder="Contoh: Manfaat Asuransi Kesehatan"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    disabled={isAutoFilling || !formData.topikUtama}
                    className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-500 text-[10px] font-bold py-1.5 rounded border border-indigo-500/20 transition-all uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAutoFilling ? (
                      <><div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> AUTO-FILLING...</>
                    ) : (
                      <><Sparkles className="w-3 h-3" /> AUTO-FILL PARAMETERS AI</>
                    )}
                  </button>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Target Audience</label>
                  <input
                    type="text"
                    name="targetAudience"
                    value={formData.targetAudience}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                    placeholder="Contoh: Keluarga muda kelas menengah"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Tujuan Artikel</label>
                  <input
                    type="text"
                    name="tujuanArtikel"
                    value={formData.tujuanArtikel}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                    placeholder="Contoh: Edukasi dan Lead Gen"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Tone Brand</label>
                  <input
                    type="text"
                    name="toneBrand"
                    value={formData.toneBrand}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                    placeholder="Contoh: Profesional, empathy, solutif"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Produk/Jasa (Soft-sell)</label>
                  <input
                    type="text"
                    name="produkJasa"
                    value={formData.produkJasa}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                    placeholder="Contoh: Asuransi SmartCare Prot"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Jumlah Kata</label>
                  <input
                    type="number"
                    name="jumlahKata"
                    value={formData.jumlahKata}
                    onChange={handleInputChange}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                    placeholder="Contoh: 1000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Negara/Bhsa</label>
                    <input
                      type="text"
                      name="negaraBahasa"
                      value={formData.negaraBahasa}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-600 dark:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Kompetitor</label>
                    <input
                      type="text"
                      name="kompetitor"
                      value={formData.kompetitor}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <hr className="my-4 border-slate-200 dark:border-slate-800" />
                <div className="space-y-4">
                  <details className="group">
                    <summary className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 cursor-pointer select-none tracking-widest border border-slate-200 dark:border-slate-800 px-3 py-2 rounded bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:border-slate-700">
                      Konfigurasi Lanjutan (Opsional)
                    </summary>
                    <div className="mt-3 space-y-3 p-3 border border-slate-200 dark:border-slate-800 rounded bg-slate-50/50 dark:bg-slate-950/50">
                       <div>
                        <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">URL Internal</label>
                        <input
                          type="text"
                          name="urlInternal"
                          value={formData.urlInternal}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-xs text-slate-700 dark:text-slate-300 focus:border-indigo-500 focus:ring-1 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Sumber Referensi</label>
                        <input
                          type="text"
                          name="sumberWajib"
                          value={formData.sumberWajib}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-xs text-slate-700 dark:text-slate-300 focus:border-indigo-500 focus:ring-1 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">Batasan Klaim</label>
                        <input
                          type="text"
                          name="batasanKlaim"
                          value={formData.batasanKlaim}
                          onChange={handleInputChange}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 text-xs text-slate-700 dark:text-slate-300 focus:border-indigo-500 focus:ring-1 outline-none"
                        />
                      </div>
                    </div>
                  </details>
                </div>
                
                {error && (
                  <div className="p-3 bg-red-950/40 text-red-400 rounded border border-red-900/50 text-[10px] font-mono">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white text-[10px] font-bold py-3 mt-4 rounded shadow-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-slate-100 dark:bg-slate-800 disabled:text-slate-500 dark:text-slate-500"
                >
                  {loading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-slate-300 border-t-white rounded-full animate-spin"></div> COMPILING...
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3" /> GENERATE
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Alt Text Generator */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 flex flex-col shrink-0">
               <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-3">
                 <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 flex items-center gap-2">
                   <ImageIcon className="w-4 h-4 text-emerald-500" /> ALT TEXT GENERATOR
                 </h2>
               </div>
               <form onSubmit={handleAltGenerate} className="space-y-4">
                 <div>
                   <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5 cursor-pointer">
                     1. Upload Gambar
                     <div className="mt-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950 p-4 flex flex-col items-center justify-center text-center transition-colors hover:border-indigo-500">
                        {altImagePreview ? (
                           <img src={altImagePreview} alt="Preview" className="max-h-32 object-contain mb-2 rounded" />
                        ) : (
                           <UploadCloud className="w-8 h-8 text-slate-600 mb-2" />
                        )}
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                           {altImagePreview ? 'Ganti Gambar' : 'Klik untuk Upload Gambar (Max 5MB)'}
                        </span>
                     </div>
                     <input type="file" accept="image/*" onChange={handleAltImageChange} className="hidden" />
                   </label>
                 </div>
                 <div>
                   <label className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">2. Konteks Artikel Singkat</label>
                   <input
                     type="text"
                     value={altContext}
                     onChange={(e) => setAltContext(e.target.value)}
                     className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-700 outline-none focus:border-emerald-500"
                     placeholder="Contoh: Asuransi kesehatan karyawan menengah"
                   />
                 </div>
                 
                 {altError && (
                   <div className="p-3 bg-red-950/40 text-red-400 rounded border border-red-900/50 text-[10px] font-mono">
                     {altError}
                   </div>
                 )}
                 {altResult && (
                   <div className="p-3 bg-slate-50 dark:bg-slate-950 text-emerald-400 rounded border border-emerald-900/50 text-[11px] font-mono whitespace-pre-wrap select-all">
                     {altResult}
                   </div>
                 )}

                 <button
                   type="submit"
                   disabled={altLoading || !altImageBase64}
                   className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-[10px] font-bold py-2.5 rounded transition-all uppercase tracking-widest flex items-center justify-center disabled:opacity-50 disabled:bg-white dark:bg-slate-900"
                 >
                   {altLoading ? (
                     <><div className="w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin mr-2"></div> GENERATING...</>
                   ) : (
                     'GENERATE ALT TEXT'
                   )}
                 </button>
               </form>
            </div>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-8 flex flex-col min-h-[600px] h-[calc(100vh-10rem)]">
             <div className="bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col flex-1 overflow-hidden relative">
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center shrink-0">
                   <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-emerald-500"></span> ENGINE OUTPUT
                   </h3>
                   <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                     SGA-7 // MODULE SYNC
                   </span>
                </div>
                
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                  {/* Sidebar Tabs */}
                  {parsedSections.length > 0 && (
                    <>
                      {/* Mobile Select */}
                      <div className="md:hidden border-b border-slate-200 dark:border-slate-800 p-2 bg-white dark:bg-slate-900 shrink-0">
                        <select 
                          value={activeTab === 'Overview' && parsedSections.length > 0 && !parsedSections.find(ps => ps.id === 'Overview') ? parsedSections[0].id : activeTab}
                          onChange={(e) => setActiveTab(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-2 text-xs text-slate-700 dark:text-slate-300 outline-none"
                        >
                          {parsedSections.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                      </div>

                      {/* Desktop Sidebar */}
                      <div className="hidden md:flex w-56 flex-col border-r border-slate-200 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30 overflow-y-auto shrink-0 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        <div className="p-2 space-y-1">
                          {parsedSections.map((s, i) => (
                            <button
                              key={s.id}
                              onClick={() => setActiveTab(s.id)}
                              className={`w-full text-left px-3 py-2 text-[10px] uppercase font-bold tracking-widest rounded transition-colors truncate ${
                                activeTab === s.id || (activeTab === 'Overview' && i === 0 && !parsedSections.find(ps => ps.id === 'Overview'))
                                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' 
                                  : 'text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-700 dark:text-slate-300 border border-transparent'
                              }`}
                            >
                              {s.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Content Pane */}
                  <div className="p-6 md:p-8 flex-1 overflow-y-auto w-full prose prose-slate dark:prose-invert max-w-none 
                     prose-headings:font-bold prose-h1:text-2xl prose-h1:tracking-tight prose-h1:mb-8
                     prose-h2:text-base prose-h2:uppercase prose-h2:tracking-widest prose-h2:border-slate-200 dark:prose-h2:border-slate-800 prose-h2:border-b prose-h2:pb-4 prose-h2:mt-12 prose-h2:mb-6
                     prose-h3:text-sm prose-h3:uppercase prose-h3:tracking-widest prose-h3:mt-8 prose-h3:mb-4
                     prose-ul:my-6 prose-ol:my-6 prose-li:my-2 prose-p:text-base prose-p:leading-loose prose-p:mb-8 prose-p:mt-0
                     prose-pre:bg-slate-50 dark:prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-slate-800 prose-pre:text-sm prose-pre:p-6 prose-pre:my-6
                     prose-a:text-indigo-600 dark:prose-a:text-indigo-400
                     scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent whitespace-pre-wrap">
                     {!result && !loading && (
                       <div className="h-full flex flex-col items-center justify-center text-slate-500 dark:text-slate-500 space-y-4 min-h-[400px]">
                          <div className="w-12 h-12 border border-slate-300 dark:border-slate-700 rounded bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center gap-1.5 opacity-50">
                             <div className="w-4 h-0.5 bg-slate-600 rounded"></div>
                             <div className="w-6 h-0.5 bg-slate-600 rounded"></div>
                             <div className="w-3 h-0.5 bg-slate-600 rounded"></div>
                          </div>
                          <p className="text-xs font-mono uppercase tracking-widest">IDLE STATE</p>
                          <p className="text-[10px] font-mono border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 rounded text-slate-500 dark:text-slate-500 max-w-xs text-center">
                             Awaiting parameters. Sub-agents standing by. Initialize to begin generating AEO-GEO structural payloads.
                          </p>
                       </div>
                     )}
                     {result && (
                       <div className="custom-markdown pb-12">
                         <Markdown>{displayedContent}</Markdown>
                       </div>
                     )}
                  </div>
                </div>

                {/* Edit Prompt Area (Only shows if result exists) */}
                {(result || isEditing) && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-4 shrink-0">
                    <form onSubmit={handleEditSubmit} className="flex gap-2">
                      <input
                        type="text"
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="Revisi hasil output dengan prompt..."
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded p-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors"
                        disabled={isEditing || loading}
                      />
                      <button
                        type="submit"
                        disabled={isEditing || loading || !editPrompt.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white text-[10px] font-bold px-6 py-3 rounded shadow-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-slate-100 dark:bg-slate-800 disabled:text-slate-500 dark:text-slate-500 shrink-0"
                      >
                        {isEditing ? (
                          <><div className="w-3 h-3 border-2 border-slate-300 border-t-white rounded-full animate-spin"></div> REVISING...</>
                        ) : (
                          <><Send className="w-4 h-4" /> REVISI</>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* Footer Status Bar in Results Area */}
                <div className="h-8 bg-indigo-900/20 border-t border-indigo-900/40 px-4 flex items-center justify-between text-[10px] font-mono text-indigo-400 shrink-0">
                  <div className="flex gap-6 hidden sm:flex">
                    <span>STATUS: {loading ? 'PROCESSING...' : (isEditing ? 'REVISING...' : (result ? 'SYNCHRONIZED' : 'STANDBY'))}</span>
                    {(result || isEditing) && <span>OUTPUT READY</span>}
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`w-1.5 h-1.5 rounded-full ${loading || isEditing ? 'bg-indigo-500 animate-pulse' : (result ? 'bg-emerald-500' : 'bg-slate-600')}`}></span>
                    <span>{loading || isEditing ? 'GENERATING PAYLOAD' : 'READY'}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

