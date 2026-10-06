import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Cotizacion {
  idCotizacion: number;
  idOrden: number;
  idTecnico: number;
  estado: string;
  totalRepuestos: number;
  manoObra: number;
  total: number;
  notas: string;
  fechaCreacion: string;
  fechaRespuesta: string;
  repuestos: any[];
  trabajos: any[];
  nombreCliente?: string;
  nombreTecnico?: string;
  equipo?: string;
  marca?: string;
  modelo?: string;
  descripcionFalla?: string;
}

@Component({
  selector: 'app-administrador-cotizaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './administrador-cotizaciones.html',
  styleUrls: ['./administrador-cotizaciones.css']
})
export class AdministradorCotizaciones implements OnInit {
  
  cotizaciones: Cotizacion[] = [];
  cotizacionesFiltradas: Cotizacion[] = [];
  cargando = false;
  error = '';
  exito = '';
  
  filtroEstado = 'TODOS';
  busqueda = '';
  
  cotizacionSeleccionada: Cotizacion | null = null;
  mostrarDetalle = false;
  
  private apiUrl = 'http://localhost:8080/api';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarCotizaciones();
  }

  cargarCotizaciones(): void {
    this.cargando = true;
    this.error = '';
    this.exito = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/cotizaciones`).subscribe({
      next: (data) => {
        this.cotizaciones = (data || []).map(c => ({
          idCotizacion: c.idCotizacion || 0,
          idOrden: c.idOrden || 0,
          idTecnico: c.idTecnico || 0,
          estado: c.estado || 'PENDIENTE_ADMIN',
          totalRepuestos: c.totalRepuestos || 0,
          manoObra: c.manoObra || 0,
          total: c.total || 0,
          notas: c.notas || '',
          fechaCreacion: c.fechaCreacion || '',
          fechaRespuesta: c.fechaRespuesta || '',
          repuestos: c.repuestos || [],
          trabajos: c.trabajos || [],
          nombreCliente: c.nombreCliente || 'Sin cliente',
          nombreTecnico: c.nombreTecnico || 'Sin técnico',
          equipo: c.equipo || 'Sin equipo',
          marca: c.marca || '',
          modelo: c.modelo || '',
          descripcionFalla: c.descripcionFalla || ''
        }));
        
        this.aplicarFiltros();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = '❌ Error al cargar cotizaciones';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==================== ESTADÍSTICAS ====================
  get totalCotizaciones(): number { 
    return this.cotizaciones.length; 
  }

  get totalPendientes(): number { 
    return this.cotizaciones.filter(c => c.estado === 'PENDIENTE_ADMIN').length; 
  }

  get totalAprobadas(): number { 
    return this.cotizaciones.filter(c => 
      c.estado === 'APROBADA_ADMIN' || c.estado === 'APROBADA_CLIENTE'
    ).length; 
  }

  get totalRechazadas(): number { 
    return this.cotizaciones.filter(c => 
      c.estado === 'RECHAZADA_ADMIN' || c.estado === 'RECHAZADA_CLIENTE'
    ).length; 
  }

  get totalMontoAprobado(): number {
    return this.cotizaciones
      .filter(c => c.estado === 'APROBADA_ADMIN' || c.estado === 'APROBADA_CLIENTE')
      .reduce((sum, c) => sum + (c.total || 0), 0);
  }

  // ==================== FILTROS ====================
  aplicarFiltros(): void {
    this.cotizacionesFiltradas = this.cotizaciones.filter(c => {
      const coincideEstado = this.filtroEstado === 'TODOS' || c.estado === this.filtroEstado;
      const texto = this.busqueda.toLowerCase().trim();
      const coincideBusqueda = !texto || 
        `OT-${c.idOrden}`.toLowerCase().includes(texto) ||
        `#${c.idCotizacion}`.includes(texto) ||
        (c.nombreCliente || '').toLowerCase().includes(texto) ||
        (c.nombreTecnico || '').toLowerCase().includes(texto) ||
        (c.equipo || '').toLowerCase().includes(texto);
      return coincideEstado && coincideBusqueda;
    });
    this.cdr.detectChanges();
  }

  filtrarPorEstado(estado: string): void {
    this.filtroEstado = estado;
    this.aplicarFiltros();
  }

  // ==================== DETALLE ====================
  verDetalle(cot: Cotizacion): void {
    this.cotizacionSeleccionada = { ...cot };
    this.mostrarDetalle = true;
    this.cdr.detectChanges();
  }

  cerrarDetalle(): void {
    this.mostrarDetalle = false;
    this.cotizacionSeleccionada = null;
    this.cdr.detectChanges();
  }

  // ==================== APROBAR/RECHAZAR (ADMIN) ====================
  aprobarCotizacion(): void {
    if (!this.cotizacionSeleccionada) return;
    const cot = this.cotizacionSeleccionada;
    
    if (!confirm(`¿Aprobar la cotización #${cot.idCotizacion}?`)) return;

    this.http.put(`${this.apiUrl}/cotizaciones/${cot.idCotizacion}/aprobar-admin`, {}).subscribe({
      next: () => {
        this.exito = `✅ Cotización #${cot.idCotizacion} aprobada`;
        this.actualizarEstadoLocal(cot.idCotizacion, 'APROBADA_ADMIN');
        this.cerrarDetalle();
        setTimeout(() => this.exito = '', 3000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = err.error?.error || 'Error al aprobar';
        setTimeout(() => this.error = '', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  rechazarCotizacion(): void {
    if (!this.cotizacionSeleccionada) return;
    const cot = this.cotizacionSeleccionada;
    
    if (!confirm(`¿Rechazar la cotización #${cot.idCotizacion}? Volverá al técnico.`)) return;

    this.http.put(`${this.apiUrl}/cotizaciones/${cot.idCotizacion}/rechazar-admin`, {}).subscribe({
      next: () => {
        this.exito = `❌ Cotización #${cot.idCotizacion} rechazada`;
        this.actualizarEstadoLocal(cot.idCotizacion, 'RECHAZADA_ADMIN');
        this.cerrarDetalle();
        setTimeout(() => this.exito = '', 3000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = err.error?.error || 'Error al rechazar';
        setTimeout(() => this.error = '', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  private actualizarEstadoLocal(idCotizacion: number, nuevoEstado: string): void {
    const idx = this.cotizaciones.findIndex(c => c.idCotizacion === idCotizacion);
    if (idx !== -1) {
      this.cotizaciones[idx].estado = nuevoEstado;
      this.cotizaciones[idx].fechaRespuesta = new Date().toISOString();
    }
    this.aplicarFiltros();
  }

  // ==================== UTILIDADES ====================
  formatearMonto(monto: number): string {
    if (monto === null || monto === undefined || isNaN(monto)) return 'S/ 0.00';
    return new Intl.NumberFormat('es-PE', { 
      style: 'currency', currency: 'PEN',
      minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(monto);
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'Sin fecha';
    try {
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) return fecha;
      return fechaObj.toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return fecha; }
  }

  claseEstado(estado: string): string {
    switch (estado) {
      case 'PENDIENTE_ADMIN': return 'pendiente';
      case 'APROBADA_ADMIN':
      case 'APROBADA_CLIENTE': return 'aprobada';
      case 'RECHAZADA_ADMIN':
      case 'RECHAZADA_CLIENTE': return 'rechazada';
      default: return 'pendiente';
    }
  }

  textoEstado(estado: string): string {
    switch (estado) {
      case 'PENDIENTE_ADMIN': return '⏳ Pendiente aprobación admin';
      case 'APROBADA_ADMIN': return '✅ Aprobada por admin';
      case 'APROBADA_CLIENTE': return '✅ Aprobada por cliente';
      case 'RECHAZADA_ADMIN': return '❌ Rechazada por admin';
      case 'RECHAZADA_CLIENTE': return '❌ Rechazada por cliente';
      default: return estado || 'Desconocido';
    }
  }

  recargar(): void {
    this.cotizacionSeleccionada = null;
    this.mostrarDetalle = false;
    this.error = '';
    this.exito = '';
    this.cdr.detectChanges();
    this.cargarCotizaciones();
  }
}