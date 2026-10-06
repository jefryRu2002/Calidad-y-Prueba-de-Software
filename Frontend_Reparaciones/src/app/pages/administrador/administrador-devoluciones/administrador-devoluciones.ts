import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface DevolucionEquipo {
  id: number;
  ticket: string;
  cliente: string;
  correoCliente: string;
  equipo: string;
  tecnico: string;
  motivoFalla: string;
  fechaDiagnostico: string;
  estadoNotificacion: 'Pendiente' | 'Notificado' | 'Devuelto';
}

@Component({
  selector: 'app-devoluciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './administrador-devoluciones.html',
  styleUrls: ['./administrador-devoluciones.css']
})
export class AdministradorDevoluciones implements OnInit {
  
  equiposIrreparables: DevolucionEquipo[] = [];
  cargando = false;
  error = '';
  exito = '';
  
  mostrarModalConfirmacion = false;
  clienteSeleccionado: DevolucionEquipo | null = null;
  
  mostrarToast = false;
  mensajeToast = '';
  
  private apiUrl = 'http://localhost:8080/api';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarDevoluciones();
  }

  get pendientesNotificar(): number {
    return this.equiposIrreparables.filter(e => e.estadoNotificacion === 'Pendiente').length;
  }

  get notificados(): number {
    return this.equiposIrreparables.filter(e => e.estadoNotificacion === 'Notificado').length;
  }

  cargarDevoluciones(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (data) => {
        // Solo órdenes con estado DEVUELTO
        const devoluciones = (data || []).filter(ot => 
          ot.estado === 'DEVUELTO'
        );

        this.equiposIrreparables = devoluciones.map(ot => ({
          id: ot.idOrden || 0,
          ticket: 'OT-' + (ot.idOrden || 0),
          cliente: ot.nombreCliente || ot.cliente || 'Sin cliente',
          correoCliente: ot.correoCliente || 'No disponible',
          equipo: (ot.marca || '') + ' ' + (ot.modelo || ''),
          tecnico: ot.nombreTecnico || 'Sin técnico',
          motivoFalla: ot.descripcion || ot.descripcionFalla || 'Rechazado por el cliente',
          fechaDiagnostico: ot.fechaFin || ot.fechaInicio || '',
          estadoNotificacion: this.mapearEstadoDevolucion(ot.estado)
        }));

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = '❌ No se pudieron cargar las devoluciones';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  private mapearEstadoDevolucion(estado: string): 'Pendiente' | 'Notificado' | 'Devuelto' {
    if (estado === 'DEVUELTO') return 'Pendiente';
    return 'Pendiente';
  }

  // ==================== NOTIFICAR CLIENTE ====================
  notificarCliente(id: number): void {
    this.clienteSeleccionado = this.equiposIrreparables.find(e => e.id === id) || null;
    if (this.clienteSeleccionado) {
      this.mostrarModalConfirmacion = true;
    }
  }

  confirmarNotificacion(): void {
    if (!this.clienteSeleccionado) return;
    
    const equipo = this.clienteSeleccionado;
    
    // Aquí podrías llamar a un endpoint para enviar correo
    // Por ahora solo simulamos
    equipo.estadoNotificacion = 'Notificado';
    this.mostrarMensajeExito(`✅ Cliente ${equipo.cliente} notificado`);
    this.cerrarModal();
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.mostrarModalConfirmacion = false;
    this.clienteSeleccionado = null;
    this.cdr.detectChanges();
  }

  // ==================== UTILIDADES ====================
  formatearFecha(fecha: string): string {
    if (!fecha) return 'Sin fecha';
    try {
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) return fecha;
      return fechaObj.toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch {
      return fecha;
    }
  }

  mostrarMensajeExito(mensaje: string): void {
    this.mensajeToast = mensaje;
    this.mostrarToast = true;
    setTimeout(() => {
      this.mostrarToast = false;
    }, 3000);
  }

  recargar(): void {
    this.cargarDevoluciones();
  }
}