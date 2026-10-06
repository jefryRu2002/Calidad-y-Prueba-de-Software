import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './administrador-gestion-pagos.html',
  styleUrls: ['./administrador-gestion-pagos.css'],
})
export class AdministradorGestionPagos implements OnInit {

  modalAbierto = false;
  pagoSeleccionado: any = null;

  pagos: any[] = [];
  pagosFiltrados: any[] = [];
  
  cargando = false;
  error = '';
  exito = '';
  procesando = false;
  
  filtroEstado = 'TODOS';
  busqueda = '';

  private apiUrl = 'http://localhost:8080/api';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarPagos();
  }

  cargarPagos(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/pagos`).subscribe({
      next: (data) => {
        this.pagos = (data || []).map(pago => ({
          id: pago.idpagos || pago.id_pago || pago.id || 0,
          idOrden: pago.ordenTrabajo?.idOrden || pago.id_orden || null,
          cliente: this.obtenerNombreCliente(pago),
          ticket: this.obtenerTicket(pago),
          monto: pago.monto || 0,
          metodo: pago.metodoPago || pago.metodo_pago || 'No especificado',
          fecha: pago.fechaPago || pago.fecha_pago || pago.fechaCreacion || '',
          estado: this.normalizarEstado(pago.estado),
          descripcion: pago.descripcion || 'Pago de reparación',
          izipayOrderId: pago.izipayOrderId || pago.izipay_order_id || '',
          tarjetaMarca: pago.tarjetaMarca || pago.tarjeta_marca || ''
        }));
        
        this.aplicarFiltros();
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al cargar pagos:', err);
        this.error = '❌ No se pudo conectar al servidor';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  private obtenerNombreCliente(pago: any): string {
    if (pago.ordenTrabajo?.reporte?.persona?.nombre) {
      const p = pago.ordenTrabajo.reporte.persona;
      return `${p.nombre || ''} ${p.apellido || ''}`.trim();
    }
    if (pago.nombreCliente) return pago.nombreCliente;
    return 'Cliente no especificado';
  }

  private obtenerTicket(pago: any): string {
    if (pago.ordenTrabajo?.idOrden) return `OT-${pago.ordenTrabajo.idOrden}`;
    if (pago.id_orden) return `OT-${pago.id_orden}`;
    return `PAGO-${pago.idpagos || pago.id || 0}`;
  }

  // ==================== ESTADOS ====================
  private normalizarEstado(estado: string): string {
    if (!estado) return 'Pendiente';
    const e = estado.toUpperCase().trim();
    if (e === 'PAGADO') return 'Pagado';         // cliente pagó, admin debe aprobar
    if (e === 'APROBADO') return 'Aprobado';
    if (e === 'PENDIENTE') return 'Pendiente';
    if (e === 'RECHAZADO') return 'Rechazado';
    return estado;
  }

  // ==================== ESTADÍSTICAS ====================
  get totalPagos(): number { return this.pagos.length; }

  get totalPendientes(): number { 
    return this.pagos.filter(p => p.estado === 'Pagado').length; 
  }

  get totalAprobados(): number { 
    return this.pagos.filter(p => p.estado === 'Aprobado').length; 
  }

  get totalRechazados(): number { 
    return this.pagos.filter(p => p.estado === 'Rechazado').length; 
  }

  get montoTotalAprobado(): number {
    return this.pagos
      .filter(p => p.estado === 'Aprobado')
      .reduce((sum, p) => sum + (p.monto || 0), 0);
  }

  // ==================== FILTROS ====================
  aplicarFiltros(): void {
    const texto = this.busqueda.toLowerCase().trim();
    this.pagosFiltrados = this.pagos.filter(pago => {
      const coincideEstado = this.filtroEstado === 'TODOS' || pago.estado === this.filtroEstado;
      const coincideBusqueda = !texto || 
        (pago.cliente || '').toLowerCase().includes(texto) ||
        (pago.ticket || '').toLowerCase().includes(texto) ||
        `#${pago.id}`.includes(texto);
      return coincideEstado && coincideBusqueda;
    });
    this.cdr.detectChanges();
  }

  filtrarPorEstado(estado: string): void {
    this.filtroEstado = estado;
    this.aplicarFiltros();
  }

  // ==================== MODAL ====================
  abrirDetalle(pago: any): void {
    this.pagoSeleccionado = { ...pago };
    this.modalAbierto = true;
    this.cdr.detectChanges();
  }

  cerrarDetalle(): void {
    this.modalAbierto = false;
    this.pagoSeleccionado = null;
    this.cdr.detectChanges();
  }

  // ==================== APROBAR PAGO ====================
  aprobarPago(id: number): void {
    if (!confirm('¿Aprobar este pago? La orden pasará a ENTREGADO.')) return;
    
    this.procesando = true;
    
    this.http.put(`${this.apiUrl}/pagos/${id}/aprobar`, {}).subscribe({
      next: () => {
        const pago = this.pagos.find(p => p.id === id);
        if (pago) pago.estado = 'Aprobado';
        
        if (this.pagoSeleccionado && this.pagoSeleccionado.id === id) {
          this.pagoSeleccionado.estado = 'Aprobado';
        }
        
        this.exito = '✅ Pago aprobado. Orden entregada.';
        this.aplicarFiltros();
        this.procesando = false;
        this.cdr.detectChanges();
        setTimeout(() => this.exito = '', 3000);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = '❌ Error al aprobar el pago';
        this.procesando = false;
        this.cdr.detectChanges();
        setTimeout(() => this.error = '', 5000);
      }
    });
  }

  // ==================== RECHAZAR PAGO ====================
  rechazarPago(id: number): void {
    if (!confirm('¿Rechazar este pago? El cliente podrá volver a pagar.')) return;

    this.procesando = true;

    this.http.put(`${this.apiUrl}/pagos/${id}/rechazar`, {
      motivo: 'Pago rechazado por administrador'
    }).subscribe({
      next: () => {
        const pago = this.pagos.find(p => p.id === id);
        if (pago) pago.estado = 'Rechazado';
        
        if (this.pagoSeleccionado && this.pagoSeleccionado.id === id) {
          this.pagoSeleccionado.estado = 'Rechazado';
        }
        
        this.exito = '❌ Pago rechazado';
        this.aplicarFiltros();
        this.procesando = false;
        this.cdr.detectChanges();
        setTimeout(() => this.exito = '', 3000);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = '❌ Error al rechazar el pago';
        this.procesando = false;
        this.cdr.detectChanges();
        setTimeout(() => this.error = '', 5000);
      }
    });
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

  recargar(): void {
    this.pagoSeleccionado = null;
    this.modalAbierto = false;
    this.error = '';
    this.exito = '';
    this.cdr.detectChanges();
    this.cargarPagos();
  }
}