import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cliente-pago.html',
  styleUrls: ['./cliente-pago.css']
})
export class ClientePago implements OnInit {

  pagosPendientes: any[] = [];
  pagosHistorial: any[] = [];
  cargando = true;
  error = '';
  exito = '';
  procesando = false;
  pagoExitoso = false;
  pagoSeleccionado: any = null;
  pestanaActiva: 'pendientes' | 'historial' = 'pendientes';
  metodoPago: 'transferencia' | 'billetera' = 'transferencia';
  mostrarQR = false;
  idCliente = 0;

  datosTransferencia = { banco: '', operacion: '', comprobante: null as File | null };
  datosBilletera = { tipo: 'yape', telefono: '', comprobante: null as File | null };

  private apiUrl = 'http://localhost:8080/api';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    this.idCliente = Number(usuario.idPersona) || 0;
    
    if (this.idCliente > 0) {
      this.cargarPagosPendientes();
    } else {
      this.cargando = false;
      this.error = '❌ No se pudo identificar al cliente';
      this.cdr.detectChanges();
    }
  }

  // ==================== PAGOS PENDIENTES ====================
  cargarPagosPendientes(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (ordenes) => {
        const misOrdenes = (ordenes || []).filter(o => {
          const idClienteOrden = o.idCliente || o.idPersona || o.id_cliente || 
                                 o.reporte?.idPersona || o.id_persona || 0;
          return Number(idClienteOrden) === this.idCliente;
        });

        // 🔥 REGLA: solo si está TERMINADO y puede_pagar = true
        this.pagosPendientes = misOrdenes
          .filter(o => 
            o.estado === 'TERMINADO' && 
            (o.puedePagar === true || o.puede_pagar === true)
          )
          .map(o => ({
            id: o.idOrden,
            ticket: 'OT-' + o.idOrden,
            equipo: (o.marca || '') + ' ' + (o.modelo || ''),
            monto: o.total || 0,
            descripcion: o.descripcion || o.descripcionFalla || 'Reparación de equipo',
            estado: 'Pendiente',
            fechaIngreso: o.fechaInicio || o.fecha_inicio || '',
            idCotizacion: o.idCotizacion || o.id_cotizacion || null
          }));

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = '❌ Error al cargar pagos';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==================== HISTORIAL ====================
  cargarHistorial(): void {
    this.http.get<any[]>(`${this.apiUrl}/pagos/cliente/${this.idCliente}/historial`).subscribe({
      next: (data) => {
        this.pagosHistorial = (data || []).map(p => ({
          id: p.id_pago || p.id || 0,
          ticket: p.ticket || '',
          monto: p.monto || 0,
          descripcion: p.descripcion || 'Reparación',
          estado: this.mapearEstado(p.estado),
          metodo: p.metodo_pago || '',
          fecha: p.fecha_pago || '',
          comprobanteUrl: p.comprobante_url || ''
        }));
        this.cdr.detectChanges();
      },
      error: () => this.cdr.detectChanges()
    });
  }

  cambiarPestana(pestana: 'pendientes' | 'historial'): void {
    this.pestanaActiva = pestana;
    this.error = '';
    this.exito = '';
    pestana === 'historial' ? this.cargarHistorial() : this.cargarPagosPendientes();
    this.cdr.detectChanges();
  }

  seleccionarPago(pago: any): void {
    this.pagoSeleccionado = pago;
    this.pagoExitoso = false;
    this.metodoPago = 'transferencia';
    this.mostrarQR = false;
    this.error = '';
    this.exito = '';
    this.limpiarFormularios();
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.pagoSeleccionado = null;
    this.mostrarQR = false;
    this.cdr.detectChanges();
  }

  // ==================== PROCESAR PAGO ====================
  procesarPago(): void {
    if (!this.pagoSeleccionado) return;
    this.error = '';
    this.exito = '';

    this.procesando = true;
    this.cdr.detectChanges();

    this.http.post(`${this.apiUrl}/pagos/procesar`, {
      pago_id: this.pagoSeleccionado.id,   // ⚠️ el backend espera idOrden aquí
      cliente_id: this.idCliente,
      metodo_pago: this.metodoPago === 'transferencia' ? 'TRANSFERENCIA' : 'BILLETERA',
      monto: this.pagoSeleccionado.monto
    }).subscribe({
      next: () => this.finalizarPagoExitoso(),
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = err.error?.error || '❌ Error al procesar el pago';
        this.procesando = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFileSelected(event: any, tipo: 'transferencia' | 'billetera'): void {
    const file = event.target.files[0];
    if (file) {
      tipo === 'transferencia' ? this.datosTransferencia.comprobante = file : this.datosBilletera.comprobante = file;
    }
  }

  limpiarFormularios(): void {
    this.datosTransferencia = { banco: '', operacion: '', comprobante: null };
    this.datosBilletera = { tipo: 'yape', telefono: '', comprobante: null };
    this.error = '';
  }

  get totalPendiente(): number {
    return this.pagosPendientes.reduce((sum, p) => sum + (p.monto || 0), 0);
  }

  formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(monto || 0);
  }

  recargar(): void {
    this.pagoSeleccionado = null;
    this.error = '';
    this.exito = '';
    this.cargarPagosPendientes();
  }

  private mapearEstado(estado: string): string {
    const m: Record<string, string> = {
      'PENDIENTE': 'Pendiente',
      'PAGADO': 'Pagado (verificando)',
      'APROBADO': 'Aprobado',
      'RECHAZADO': 'Rechazado'
    };
    return m[estado?.toUpperCase()] || estado || 'Pendiente';
  }

  private finalizarPagoExitoso(): void {
    this.pagosHistorial.unshift({
      id: Date.now(),
      ticket: 'OT-' + this.pagoSeleccionado.id,
      monto: this.pagoSeleccionado.monto,
      descripcion: this.pagoSeleccionado.descripcion,
      estado: 'Pagado (verificando)',
      metodo: this.metodoPago === 'transferencia' ? 'TRANSFERENCIA' : 'BILLETERA',
      fecha: new Date().toISOString()
    });

    this.pagosPendientes = this.pagosPendientes.filter(p => p.id !== this.pagoSeleccionado.id);
    this.exito = '✅ Pago registrado. El administrador lo verificará pronto.';
    this.procesando = false;
    this.pagoSeleccionado = null;
    this.cdr.detectChanges();
    setTimeout(() => { this.exito = ''; this.cdr.detectChanges(); }, 5000);
  }
}