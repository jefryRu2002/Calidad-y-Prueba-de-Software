import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface OrdenReciente {
  id: number;
  ticket: string;
  equipo: string;
  cliente: string;
  estado: string;
}

interface Cotizacion {
  id: number;
  ticket: string;
  equipo: string;
  cliente: string;
  estado: string;
  monto: number;
  fecha: string;
}

@Component({
  selector: 'app-tecnico-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tecnico-dashboard.html',
  styleUrls: ['./tecnico-dashboard.css']
})
export class TecnicoDashboard implements OnInit {

  nombreTecnico = '';
  idTecnico: number = 0;
  cargando = false;
  error = '';

  // KPIs según el flujo nuevo
  totalAsignadas = 0;
  enDiagnostico = 0;      // ASIGNADO (listas para evaluar)
  listasParaCotizar = 0;  // EN_PROCESO
  cotizadas = 0;          // COTIZADO
  enReparacion = 0;       // EN_REPARACION
  enPruebas = 0;          // EN_PRUEBAS
  listosEntrega = 0;      // TERMINADO

  ordenesRecientes: OrdenReciente[] = [];
  cotizaciones: Cotizacion[] = [];

  private apiUrl = 'http://localhost:8080/api';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const usuario: Record<string, unknown> = JSON.parse(localStorage.getItem('usuario') || '{}');
    this.idTecnico = Number(usuario['idPersona']) || 0;
    this.nombreTecnico = (usuario['nombre'] as string) || 'Técnico';

    if (this.idTecnico > 0) {
      this.cargarDashboard();
    } else {
      this.error = 'No se pudo identificar al técnico.';
    }
  }

  cargarDashboard(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (data) => {
        const ordenes = Array.isArray(data) ? data : [];

        // Solo órdenes de este técnico
        const misOrdenes = ordenes.filter(o => {
          const idTecnicoOrden = Number(o.idTecnico || o.id_tecnico || 0);
          return idTecnicoOrden === this.idTecnico;
        });

        // Contadores por estado
        this.totalAsignadas = misOrdenes.length;
        this.enDiagnostico = misOrdenes.filter(o => o.estado === 'ASIGNADO').length;
        this.listasParaCotizar = misOrdenes.filter(o => o.estado === 'EN_PROCESO').length;
        this.cotizadas = misOrdenes.filter(o => o.estado === 'COTIZADO').length;
        this.enReparacion = misOrdenes.filter(o => o.estado === 'EN_REPARACION').length;
        this.enPruebas = misOrdenes.filter(o => o.estado === 'EN_PRUEBAS').length;
        this.listosEntrega = misOrdenes.filter(o => o.estado === 'TERMINADO').length;

        // Últimas 5
        this.ordenesRecientes = misOrdenes
          .sort((a, b) => (b.idOrden || 0) - (a.idOrden || 0))
          .slice(0, 5)
          .map(o => ({
            id: o.idOrden,
            ticket: `OT-${o.idOrden}`,
            equipo: `${o.marca || ''} ${o.modelo || ''}`.trim() || 'Sin equipo',
            cliente: o.nombreCliente || 'Sin cliente',
            estado: this.textoEstado(o.estado)
          }));

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = 'Error al cargar los datos.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });

    // Cotizaciones del técnico
    this.http.get<any[]>(`${this.apiUrl}/cotizaciones`).subscribe({
      next: (data) => {
        const cots = Array.isArray(data) ? data : [];
        this.cotizaciones = cots
          .filter(c => c.idTecnico === this.idTecnico && c.estado === 'PENDIENTE_ADMIN')
          .slice(0, 5)
          .map(c => ({
            id: c.idCotizacion,
            ticket: `OT-${c.idOrden}`,
            equipo: c.equipo || 'Sin equipo',
            cliente: c.nombreCliente || 'Sin cliente',
            estado: 'Esperando admin',
            monto: c.total || 0,
            fecha: c.fechaCreacion || ''
          }));
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  textoEstado(estado: string): string {
    const map: Record<string, string> = {
      'PENDIENTE': '⏳ Pendiente',
      'ASIGNADO': '👤 Asignado',
      'EN_PROCESO': '🔍 En diagnóstico',
      'COTIZADO': '💰 Cotizado',
      'COTIZACION_RECHAZADA_ADMIN': '❌ Cotización rechazada',
      'COTIZACION_APROBADA': '✅ Cotización aprobada',
      'EN_REPARACION': '🔧 En reparación',
      'EN_PRUEBAS': '🧪 En pruebas',
      'TERMINADO': '✅ Terminado',
      'ENTREGADO': '📦 Entregado',
      'DEVUELTO': '↩️ Devuelto'
    };
    return map[estado] || estado;
  }

  claseEstado(estado: string): string {
    const c: Record<string, string> = {
      'PENDIENTE': 'recepcion',
      'ASIGNADO': 'diagnostico',
      'EN_PROCESO': 'diagnostico',
      'COTIZADO': 'recepcion',
      'COTIZACION_RECHAZADA_ADMIN': 'recepcion',
      'COTIZACION_APROBADA': 'terminado',
      'EN_REPARACION': 'reparacion',
      'EN_PRUEBAS': 'pruebas',
      'TERMINADO': 'terminado',
      'ENTREGADO': 'terminado',
      'DEVUELTO': 'recepcion'
    };
    return c[estado] || 'recepcion';
  }

  formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-PE', { 
      style: 'currency', currency: 'PEN',
      minimumFractionDigits: 2 
    }).format(monto || 0);
  }

  recargarDatos(): void {
    this.cargarDashboard();
  }
}