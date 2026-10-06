import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

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

    // 1. Órdenes de trabajo
    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (ordenes) => {
        this.estadisticas.reparaciones = ordenes?.length || 0;
        this.estadisticas.pendientes = (ordenes || []).filter(o => 
          o.estado === 'PENDIENTE' || o.estado === 'ASIGNADO' || o.estado === 'EN_PROCESO'
        ).length;

        // Últimas 10 reparaciones
        this.ultimasReparaciones = (ordenes || [])
          .sort((a, b) => new Date(b.fechaInicio || 0).getTime() - new Date(a.fechaInicio || 0).getTime())
          .slice(0, 10)
          .map(orden => ({
            id: orden.idOrden || 0,
            ticket: 'OT-' + (orden.idOrden || 0),
            cliente: orden.nombreCliente || 'Sin cliente',
            equipo: orden.equipo || (orden.marca || '') + ' ' + (orden.modelo || '') || 'Sin equipo',
            estado: this.mapearEstado(orden.estado),
            tecnico: orden.nombreTecnico || 'No asignado',
            fecha: orden.fechaInicio || new Date()
          }));

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error al cargar órdenes:', err);
        this.error = '❌ Error al conectar con el servidor';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });

    // 2. Ingresos desde pagos aprobados (UNA SOLA fuente: pagos)
    this.http.get<any[]>(`${this.apiUrl}/pagos`).subscribe({
      next: (pagos) => {
        this.estadisticas.ingresos = (pagos || [])
          .filter(p => p.estado === 'APROBADO' || p.estado === 'PAGADO')
          .reduce((sum, p) => sum + (p.monto || 0), 0);
        this.cdr.detectChanges();
      },
      error: () => console.log('⚠️ No se cargaron pagos')
    });

    // 3. Total clientes
    this.http.get<any[]>(`${this.apiUrl}/clientes`).subscribe({
      next: (data) => {
        this.estadisticas.clientes = data?.length || 0;
        this.cdr.detectChanges();
      },
      error: () => console.log('⚠️ No se cargaron clientes')
    });

    // 4. Total técnicos
    this.http.get<any[]>(`${this.apiUrl}/tecnicos`).subscribe({
      next: (data) => {
        this.estadisticas.tecnicos = data?.length || 0;
        this.cdr.detectChanges();
      },
      error: () => console.log('⚠️ No se cargaron técnicos')
    });
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