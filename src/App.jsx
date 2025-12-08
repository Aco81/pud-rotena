import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { 
  Wifi, 
  WifiOff, 
  Database, 
  User, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ExternalLink
} from 'lucide-react';

// --- 1. CONFIGURACIÓN DE FIREBASE (Tus datos) ---
const firebaseConfig = {
  apiKey: "AIzaSyA1MuetIpVz6ki2_mdhf4J831oMB8pw39A",
  authDomain: "rotena-519e4.firebaseapp.com",
  projectId: "rotena-519e4",
  storageBucket: "rotena-519e4.firebasestorage.app",
  messagingSenderId: "872970314926",
  appId: "1:872970314926:web:577fcdc52aa0fb2aa7f93f",
  measurementId: "G-ZWFN8WCQFN"
};

// --- 2. INICIALIZACIÓN ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID de la aplicación para el entorno de almacenamiento
const appId = typeof __app_id !== 'undefined' ? __app_id : 'rotena-app-default';

export default function App() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detailedError, setDetailedError] = useState(null); // Para mostrar ayuda específica
  const [dbStatus, setDbStatus] = useState('connecting');

  // --- 3. GESTIÓN DE AUTENTICACIÓN ---
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Intentamos autenticación anónima
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Error de autenticación detallado:", err);
        if (mounted) {
          setError(err.message);
          
          // Diagnóstico específico para el error que estás recibiendo
          if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
            setDetailedError({
              title: "Autenticación no encontrada u oculta",
              message: "Firebase no encuentra el servicio de autenticación. Puede estar en la sección 'Compilación' (Build).",
              link: `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`,
              steps: [
                "1. Haz clic en el botón de abajo 'Ir a Configuración Auth'.",
                "2. Si ves un botón 'Comenzar' (Get Started), púlsalo.",
                "3. En la pestaña 'Sign-in method', busca 'Anónimo'.",
                "4. Activa el interruptor 'Habilitar' y guarda."
              ]
            });
          } else if (err.code === 'auth/api-key-not-valid') {
             setDetailedError({
              title: "API Key Inválida",
              message: "La API Key en la configuración no parece válida.",
              steps: ["Verifica que has copiado la 'apiKey' correctamente."]
             });
          }
        }
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (mounted) {
        setUser(currentUser);
        setLoading(false);
        if (currentUser) {
            setError(null);
            setDetailedError(null);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // --- 4. GESTIÓN DE DATOS (Firestore) ---
  useEffect(() => {
    if (!user) return;

    const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'test_items');

    const unsubscribe = onSnapshot(
      collectionPath,
      (snapshot) => {
        const loadedItems = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        loadedItems.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setItems(loadedItems);
        setDbStatus('connected');
      },
      (err) => {
        console.error("Error Firestore:", err);
        setDbStatus('error');
        // Solo mostrar error de DB si no hay error de Auth previo
        if (!error) setError("Error conectando a la base de datos. Verifica las reglas de seguridad.");
      }
    );

    return () => unsubscribe();
  }, [user, error]);

  // --- 5. FUNCIONES ---
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.trim() || !user) return;

    try {
      const collectionPath = collection(db, 'artifacts', appId, 'public', 'data', 'test_items');
      await addDoc(collectionPath, {
        text: newItem,
        createdAt: serverTimestamp(),
        userId: user.uid,
        userEmail: 'Anónimo'
      });
      setNewItem('');
    } catch (err) {
      console.error("Error al escribir:", err);
      alert("Error al guardar: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'test_items', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error al borrar:", err);
    }
  };

  // --- RENDERIZADO ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Database className="text-blue-600" />
            Panel de Control Firebase
          </h1>

          {/* Panel de Estado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className={`p-3 rounded-lg border flex items-center gap-3 ${user ? 'bg-green-50 border-green-200' : error ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className={`p-2 rounded-full ${user ? 'bg-green-100 text-green-700' : error ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {error ? <AlertCircle size={20} /> : <User size={20} />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Autenticación</p>
                <p className="font-medium text-sm truncate max-w-[200px]">
                  {loading ? 'Iniciando...' : (user ? `Conectado` : 'Error')}
                </p>
              </div>
            </div>

            <div className={`p-3 rounded-lg border flex items-center gap-3 ${dbStatus === 'connected' ? 'bg-indigo-50 border-indigo-200' : dbStatus === 'error' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`p-2 rounded-full ${dbStatus === 'connected' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                {dbStatus === 'connected' ? <Wifi size={20} /> : <WifiOff size={20} />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Base de Datos</p>
                <p className="font-medium text-sm">
                  {dbStatus === 'connected' ? 'Sincronizado' : dbStatus === 'error' ? 'Error Conexión' : 'Esperando...'}
                </p>
              </div>
            </div>
          </div>
          
          {/* MENSAJE DE ERROR DETALLADO E INSTRUCCIONES */}
          {detailedError && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="flex items-start gap-3">
                <HelpCircle className="text-orange-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-bold text-orange-800 mb-1">{detailedError.title}</h3>
                  <p className="text-sm text-orange-700 mb-4">{detailedError.message}</p>
                  
                  {detailedError.link && (
                    <a 
                      href={detailedError.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors mb-4 shadow-sm"
                    >
                      <ExternalLink size={16} />
                      Ir a Configuración Auth
                    </a>
                  )}

                  <div className="bg-white/60 rounded-lg p-3 border border-orange-100">
                    <p className="text-xs font-bold text-orange-800 uppercase mb-2">Instrucciones paso a paso:</p>
                    <ol className="list-none text-sm text-orange-900 space-y-2">
                      {detailedError.steps.map((step, idx) => (
                        <li key={idx} className="flex gap-2">
                           <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}

           {error && !detailedError && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

        </div>

        {/* Zona de Pruebas (Solo visible si no hay error crítico de auth) */}
        <div className={`bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden transition-all duration-300 ${!user ? 'opacity-60 pointer-events-none grayscale' : 'opacity-100'}`}>
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-semibold text-slate-700">Prueba de Datos</h2>
            <span className="text-xs bg-slate-200 px-2 py-1 rounded-full text-slate-600">Colección: test_items</span>
          </div>

          <div className="p-6">
            <form onSubmit={handleAddItem} className="flex gap-2 mb-6">
              <input
                type="text"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Escribe algo..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button 
                type="submit" 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700"
              >
                <Plus size={18} /> Añadir
              </button>
            </form>

            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-green-500" />
                    <span className="text-slate-800">{item.text}</span>
                  </div>
                  <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {items.length === 0 && <p className="text-center text-slate-400 py-4">Sin datos aún.</p>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
