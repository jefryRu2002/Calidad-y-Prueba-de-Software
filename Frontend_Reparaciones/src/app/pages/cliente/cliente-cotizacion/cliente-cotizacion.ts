import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-cliente-cotizacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cliente-cotizacion.html',
  styleUrls: ['./cliente-cotizacion.css']
})
export class ClienteCotizacion implements OnInit {
  
  cotizaciones: any[] = [];
  cargando = false;
  error = '';
  exito = '';
  idCliente = 0;
  
  private apiUrl = 'http://localhost:8080/api';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    this.idCliente = Number(usuario.idPersona) || 0;
    this.cargarCotizaciones();
  }

  cargarCotizaciones(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    // 1. Obtener todas las cotizaciones
    this.http.get<any[]>(`${this.apiUrl}/cotizaciones`).subscribe({
      next: (cotizaciones) => {
        // 2. Obtener las órdenes para saber cuáles son mis órdenes
        this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
          next: (ordenes) => {
            // IDs de las órdenes de este cliente
            const misOrdenesIds = new Set(
              (ordenes || [])
                .filter(o => {
                  const idClienteOrden = Number(
                    o.idCliente || o.idPersona || o.id_cliente || o.id_persona || 0
                  );
                  return idClienteOrden === this.idCliente;
                })
                .map(o => Number(o.idOrden))
            );

            // Filtrar cotizaciones: de mis órdenes Y con estado válido para ver
            const misCotizaciones = (cotizaciones || []).filter(c => {
              const idOrdenCot = Number(c.idOrden);
              const estadoOk = 
                c.estado === 'APROBADA_ADMIN' || 
                c.estado === 'APROBADA_CLIENTE' || 
                c.estado === 'RECHAZADA_CLIENTE';
              return misOrdenesIds.has(idOrdenCot) && estadoOk;
            });

            this.cotizaciones = misCotizaciones.map(c => ({
              idCotizacion: c.idCotizacion,
              idOrden: c.idOrden,
              ticket: 'OT-' + c.idOrden,
              equipo: c.equipo || 'Sin equipo',
              estado: c.estado,
              total: c.total || 0,
              totalRepuestos: c.totalRepuestos || 0,
              totalTrabajos: c.totalTrabajos || 0,
              manoObra: c.manoObra || 0,
              fecha: c.fechaCreacion || '',
              descripcion: c.descripcionFalla || c.notas || ''
            }));

            this.cargando = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('❌ Error al cargar órdenes:', err);
            this.error = '❌ Error al cargar tus órdenes';
            this.cargando = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = '❌ Error al cargar cotizaciones';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==================== ACEPTAR ====================
  aceptar(id: number): void {
    if (!confirm('¿Aceptar esta cotización? Se procederá con la reparación.')) return;

    this.cargando = true;
    this.cdr.detectChanges();

    this.http.put(`${this.apiUrl}/cotizaciones/${id}/aprobar-cliente`, {}).subscribe({
      next: () => {
        this.exito = '✅ Cotización aceptada. El técnico iniciará la reparación.';
        this.cargando = false;
        this.cdr.detectChanges();
        this.cargarCotizaciones();
        setTimeout(() => { this.exito = ''; this.cdr.detectChanges(); }, 5000);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = err.error?.error || '❌ Error al aceptar la cotización';
        this.cargando = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.error = ''; this.cdr.detectChanges(); }, 5000);
      }
    });
  }

  // ==================== RECHAZAR ====================
  rechazar(id: number): void {
    if (!confirm('¿Rechazar esta cotización? El equipo será devuelto sin reparación.')) return;

    this.cargando = true;
    this.cdr.detectChanges();

    this.http.put(`${this.apiUrl}/cotizaciones/${id}/rechazar-cliente`, {}).subscribe({
      next: () => {
        this.exito = '❌ Cotización rechazada. Se coordinará la devolución del equipo.';
        this.cargando = false;
        this.cdr.detectChanges();
        this.cargarCotizaciones();
        setTimeout(() => { this.exito = ''; this.cdr.detectChanges(); }, 5000);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = err.error?.error || '❌ Error al rechazar la cotización';
        this.cargando = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.error = ''; this.cdr.detectChanges(); }, 5000);
      }
    });
  }

  // ==================== UTILIDADES ====================
  formatearMonto(monto: number): string {
    if (!monto || monto === 0) return 'S/ 0.00';
    return new Intl.NumberFormat('es-PE', { 
      style: 'currency', 
      currency: 'PEN',
      minimumFractionDigits: 2 
    }).format(monto);
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'Sin fecha';
    try { 
      return new Date(fecha).toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }); 
    } catch { 
      return fecha; 
    }
  }

  recargar(): void {
    this.cargarCotizaciones();
  }
}