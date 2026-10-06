import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface Solicitud {
  id: number;            // idReporte
  idOrden?: number;      // idOrden (si existe)
  codigo: string;
  equipo: string;
  tipo: string;
  serie: string;
  estado: string;
  fecha: string;
  fechaRaw: string;
  descripcion: string;
  marca: string;
  modelo: string;
  idCliente: string;
}

@Component({
  selector: 'app-cliente-estado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cliente-estado-solicitud.html',
  styleUrls: ['./cliente-estado-solicitud.css']
})
export class ClienteEstadoSolicitud implements OnInit, OnDestroy {

  solicitudes: Solicitud[] = [];
  cargando = true;
  buscador = '';
  estadoFiltro = '';
  reporteSeleccionado: Solicitud | null = null;

  private apiUrl = 'http://localhost:8080/api';
  private clienteId: string = '';
  private intervaloActualizacion: any;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    this.clienteId = String(usuario.idPersona ?? '');
  }

  ngOnInit(): void {
    this.cargarSolicitudes();
    this.intervaloActualizacion = setInterval(() => this.cargarSolicitudes(), 30000);
  }

  ngOnDestroy(): void {
    if (this.intervaloActualizacion) clearInterval(this.intervaloActualizacion);
  }

  cargarSolicitudes(): void {
    this.cargando = true;
    this.cdr.detectChanges();

    // Cargar reportes Y órdenes en paralelo
    forkJoin({
      reportes: this.http.get<any[]>(`${this.apiUrl}/reportes`).pipe(catchError(() => of([]))),
      ordenes: this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ reportes, ordenes }) => {
        // Filtrar reportes del cliente
        const misReportes = (reportes || []).filter(r => 
          String(r.idPersona ?? '') === this.clienteId
        );

        // Mapa: idReporte → orden
        const ordenPorReporte = new Map<number, any>();
        (ordenes || []).forEach(o => {
          const idReporte = Number(o.idReporte || o.id_reporte || 0);
          if (idReporte > 0) {
            ordenPorReporte.set(idReporte, o);
          }
        });

        // Combinar: por cada reporte, buscar su orden (si existe)
        this.solicitudes = misReportes.map(r => {
          const idReporte = r.idReporte || r.id_reporte;
          const orden = ordenPorReporte.get(idReporte);
          
          // Estado: si tiene orden, usar el estado de la orden; si no, PENDIENTE
          const estado = orden ? (orden.estado || 'PENDIENTE') : 'PENDIENTE';
          
          return {
            id: idReporte,
            idOrden: orden?.idOrden,
            codigo: orden ? ('OT-' + orden.idOrden) : ('REP-' + idReporte),
            equipo: `${r.marca || ''} ${r.modelo || ''}`.trim() || 'Sin equipo',
            tipo: r.tipoEquipo || 'N/A',
            serie: r.numeroSerie || 'N/A',
            estado: estado,
            fecha: this.formatearFecha(r.fechaReporte),
            fechaRaw: r.fechaReporte,
            descripcion: r.descripcionFalla || '',
            marca: r.marca || '',
            modelo: r.modelo || '',
            idCliente: String(r.idPersona ?? '')
          };
        });

        this.solicitudes.sort((a, b) => new Date(b.fechaRaw).getTime() - new Date(a.fechaRaw).getTime());
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  get solicitudesFiltradas(): Solicitud[] {
    let resultado = [...this.solicitudes];
    const q = this.buscador.toLowerCase().trim();
    if (q) {
      resultado = resultado.filter(s =>
        s.codigo.toLowerCase().includes(q) || s.equipo.toLowerCase().includes(q) ||
        s.marca.toLowerCase().includes(q) || s.modelo.toLowerCase().includes(q) ||
        s.tipo.toLowerCase().includes(q) || s.serie.toLowerCase().includes(q) ||
        s.descripcion.toLowerCase().includes(q)
      );
    }
    if (this.estadoFiltro) {
      resultado = resultado.filter(s => s.estado === this.estadoFiltro);
    }
    return resultado;
  }

  contarPorEstado(estado: string): number {
    return this.solicitudes.filter(s => s.estado === estado).length;
  }

  limpiarFiltros(): void {
    this.buscador = '';
    this.estadoFiltro = '';
    this.cdr.detectChanges();
  }

  verDetalle(solicitud: Solicitud): void {
    this.reporteSeleccionado = solicitud;
    this.cdr.detectChanges();
  }

  cerrarDetalle(): void {
    this.reporteSeleccionado = null;
    this.cdr.detectChanges();
  }

  getEstadoClase(estado: string): string {
    const clases: Record<string, string> = {
      'PENDIENTE': 'estado-pendiente',
      'ASIGNADO': 'estado-pendiente',
      'EN_PROCESO': 'estado-proceso',
      'COTIZADO': 'estado-proceso',
      'COTIZACION_RECHAZADA_ADMIN': 'estado-proceso',
      'COTIZACION_APROBADA': 'estado-proceso',
      'EN_REPARACION': 'estado-proceso',
      'EN_PRUEBAS': 'estado-proceso',
      'TERMINADO': 'estado-terminado',
      'ENTREGADO': 'estado-entregado',
      'DEVUELTO': 'estado-cancelado'
    };
    return clases[estado] || 'estado-pendiente';
  }

  getEstadoIcono(estado: string): string {
    const iconos: Record<string, string> = {
      'PENDIENTE': '⏳',
      'ASIGNADO': '👤',
      'EN_PROCESO': '🔍',
      'COTIZADO': '⏳',
      'COTIZACION_RECHAZADA_ADMIN': '⏳',
      'COTIZACION_APROBADA': '💰',
      'EN_REPARACION': '🔧',
      'EN_PRUEBAS': '🧪',
      'TERMINADO': '✅',
      'ENTREGADO': '📦',
      'DEVUELTO': '↩️'
    };
    return iconos[estado] || '⏳';
  }

  getEstadoTexto(estado: string): string {
    const textos: Record<string, string> = {
      'PENDIENTE': 'Pendiente',
      'ASIGNADO': 'Asignado',
      'EN_PROCESO': 'En diagnóstico',
      'COTIZADO': 'Preparando cotización',
      'COTIZACION_RECHAZADA_ADMIN': 'Preparando cotización',
      'COTIZACION_APROBADA': 'Cotización disponible',
      'EN_REPARACION': 'En reparación',
      'EN_PRUEBAS': 'En pruebas',
      'TERMINADO': 'Listo para recoger',
      'ENTREGADO': 'Entregado',
      'DEVUELTO': 'Devuelto'
    };
    return textos[estado] || estado;
  }

  recargarDatos(): void { 
    this.cargarSolicitudes(); 
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

  formatearFechaCompleta(fecha: string): string {
    if (!fecha) return 'Sin fecha';
    try {
      return new Date(fecha).toLocaleDateString('es-PE', { 
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  }
}