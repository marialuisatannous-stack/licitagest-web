import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Clientes from './pages/Clientes.jsx'
import Editais from './pages/Editais.jsx'
import NovoEdital from './pages/NovoEdital.jsx'
import Documentos from './pages/Documentos.jsx'
import Validacao from './pages/Validacao.jsx'
import Agenda from './pages/Agenda.jsx'

function PrivateRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="clientes"   element={<Clientes />} />
        <Route path="editais"    element={<Editais />} />
        <Route path="editais/novo" element={<NovoEdital />} />
        <Route path="documentos" element={<Documentos />} />
        <Route path="validacao"  element={<Validacao />} />
        <Route path="agenda"     element={<Agenda />} />
      </Route>
    </Routes>
  </BrowserRouter>
)
