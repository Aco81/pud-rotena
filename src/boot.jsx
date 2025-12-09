import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Log visible en consola para confirmar que este archivo se carga
console.log("Boot.jsx cargado. Intentando renderizar React...");

try {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error("No se encontró el elemento con id 'root' en el HTML.");
  }

  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  
  console.log("React render ejecutado correctamente.");

} catch (e) {
  console.error("Error al montar React:", e);
  // Forzar error visible en pantalla
  if (window.onerror) {
      window.onerror(e.message, 'src/boot.jsx', 0, 0, e);
  } else {
      document.body.innerHTML = `<div style="color:red; padding:20px; font-size:20px;"><h1>ERROR CRÍTICO BOOT</h1><pre>${e.message}</pre></div>`;
  }
}
