import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-administrador-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './administrador-dashboard.html',
  styleUrls: ['./administrador-dashboard.css']
})
export class AdministradorDashboard implements OnInit {

  estadisticas = {
    reparaciones: 0,
    pendientes: 0,
    ingresos: 0,
    clientes: 0,
    tecnicos: 0
  };

  ultimasReparaciones: any[] = [];
  cargando = true;
  error = '';

  private apiUrl = 'http://localhost:8080/api';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarDashboard();
  }

  cargarDashboard(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    forkJoin({
      ordenes: this.http.get<any>(`${this.apiUrl}/ordenes-trabajo`).pipe(
        catchError((err) => {
          console.error('❌ Error al cargar órdenes:', {
            status: err.status,
            statusText: err.statusText,
            message: err.message,
            url: err.url,
            error: err.error
          });
          this.error = '❌ Error al conectar con el servidor';
          return of([]);
        })
      ),
      pagos: this.http.get<any>(`${this.apiUrl}/pagos`).pipe(
        catchError((err) => {
          console.warn('⚠️ No se cargaron pagos:', err.status);
          return of([]);
        })
      ),
      clientes: this.http.get<any>(`${this.apiUrl}/clientes`).pipe(
        catchError((err) => {
          console.error('❌ Error al cargar clientes:', {
            status: err.status,
            statusText: err.statusText,
            message: err.message,
            url: err.url,
            error: err.error
          });
          return of([]);
        })
      ),
      tecnicos: this.http.get<any>(`${this.apiUrl}/tecnicos`).pipe(
        catchError((err) => {
          console.error('❌ Error al cargar técnicos:', {
            status: err.status,
            statusText: err.statusText,
            message: err.message,
            url: err.url,
            error: err.error
          });
          return of([]);
        })
      )
    }).subscribe(({ ordenes, pagos, clientes, tecnicos }) => {

      // ---- Normalizar respuestas a arrays ----
      const listaOrdenes = this.extraerLista(ordenes, 'ordenes');
      const listaPagos = this.extraerLista(pagos, 'pagos');
      const listaClientes = this.extraerLista(clientes, 'clientes');
      const listaTecnicos = this.extraerLista(tecnicos, 'tecnicos');

      // Debug temporal: mira en consola la forma real que llega del backend
      console.log('📦 RAW /clientes:', clientes);
      console.log('📦 RAW /tecnicos:', tecnicos);
      console.log('📊 Conteos:', {
        ordenes: listaOrdenes.length,
        pagos: listaPagos.length,
        clientes: listaClientes.length,
        tecnicos: listaTecnicos.length
      });

      // ---- Órdenes ----
      this.estadisticas.reparaciones = listaOrdenes.length;
      this.estadisticas.pendientes = listaOrdenes.filter((o: any) =>
        o.estado === 'PENDIENTE' ||
        o.estado === 'ASIGNADO' ||
        o.estado === 'EN_PROCESO'
      ).length;

      // Últimas 10 reparaciones
      this.ultimasReparaciones = listaOrdenes
        .sort((a: any, b: any) =>
          new Date(b.fechaInicio || 0).getTime() - new Date(a.fechaInicio || 0).getTime()
        )
        .slice(0, 10)
        .map((orden: any) => ({
          id: orden.idOrden || 0,
          ticket: 'OT-' + (orden.idOrden || 0),
          cliente: orden.nombreCliente || 'Sin cliente',
          equipo: orden.equipo || `${orden.marca || ''} ${orden.modelo || ''}`.trim() || 'Sin equipo',
          estado: this.mapearEstado(orden.estado),
          tecnico: orden.nombreTecnico || 'No asignado',
          fecha: orden.fechaInicio || new Date()
        }));

      // ---- Ingresos desde pagos aprobados ----
      this.estadisticas.ingresos = listaPagos
        .filter((p: any) => p.estado === 'APROBADO' || p.estado === 'PAGADO')
        .reduce((sum: number, p: any) => sum + (p.monto || 0), 0);

      // ---- Clientes ----
      this.estadisticas.clientes = listaClientes.length;

      // ---- Técnicos ----
      this.estadisticas.tecnicos = listaTecnicos.length;

      this.cargando = false;
      this.cdr.detectChanges();
    });
  }

  /**
   * Normaliza cualquier respuesta del backend a un array.
   * Soporta:
   *  - Array plano: [ {...}, {...} ]
   *  - Spring Page: { content: [...], totalElements: N }
   *  - Envoltorio: { data: [...] } | { clientes: [...] } | { tecnicos: [...] } | { ordenes: [...] } | { pagos: [...] }
   *  - items / results
   *  - null / undefined → []
   */
  private extraerLista(respuesta: any, clave: string): any[] {
    if (Array.isArray(respuesta)) return respuesta;
    if (respuesta == null) return [];
    if (Array.isArray(respuesta.content)) return respuesta.content;
    if (Array.isArray(respuesta.data)) return respuesta.data;
    if (Array.isArray(respuesta[clave])) return respuesta[clave];
    if (Array.isArray(respuesta.items)) return respuesta.items;
    if (Array.isArray(respuesta.results)) return respuesta.results;
    return [];
  }

  mapearEstado(estado: string): string {
    if (!estado) return 'Pendiente';
    const map: Record<string, string> = {
      'PENDIENTE': 'Pendiente',
      'ASIGNADO': 'Asignado',
      'EN_PROCESO': 'En diagnóstico',
      'COTIZADO': 'Cotizado',
      'COTIZACION_RECHAZADA_ADMIN': 'Cotización rechazada',
      'COTIZACION_APROBADA': 'Cotización aprobada',
      'EN_REPARACION': 'En reparación',
      'EN_PRUEBAS': 'En pruebas',
      'TERMINADO': 'Listo para entrega',
      'ENTREGADO': 'Entregado',
      'DEVUELTO': 'Devuelto'
    };
    return map[estado] || estado;
  }

  getEstadoClass(estado: string): string {
    const e = (estado || '').toLowerCase();
    if (e.includes('pendiente') || e.includes('cotizado')) return 'pendiente';
    if (e.includes('asignado') || e.includes('proceso') || e.includes('reparacion') || e.includes('pruebas') || e.includes('aprobada')) return 'proceso';
    if (e.includes('terminado') || e.includes('listo') || e.includes('entregado')) return 'terminado';
    if (e.includes('rechazada') || e.includes('devuelto')) return 'cancelado';
    return 'pendiente';
  }

  formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2
    }).format(monto || 0);
  }

  recargar(): void {
    this.cdr.detectChanges();
    this.cargarDashboard();
  }
}