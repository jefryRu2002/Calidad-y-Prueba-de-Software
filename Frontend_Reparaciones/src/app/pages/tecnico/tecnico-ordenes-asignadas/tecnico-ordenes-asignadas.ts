import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-ordenes-asignadas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tecnico-ordenes-asignadas.html',
  styleUrls: ['./tecnico-ordenes-asignadas.css']
})
export class TecnicoOrdenesAsignadas implements OnInit {

  ordenes: any[] = [];
  cargando = true;
  error = '';
  exito = '';
  filtroEstado = 'TODOS';
  busqueda = '';
  idTecnico = 0;

  private apiUrl = 'http://localhost:8080/api';

  // Estados que el técnico ve
  private estadosVisibles = [
    'ASIGNADO',
    'EN_PROCESO',
    'COTIZADO',
    'COTIZACION_RECHAZADA_ADMIN',
    'COTIZACION_APROBADA',
    'EN_REPARACION',
    'EN_PRUEBAS',
    'TERMINADO',
    'ENTREGADO'
  ];

  constructor(private http: HttpClient, public cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    try {
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      this.idTecnico = Number(usuario.idPersona || usuario.id || 0);
    } catch (e) {
      this.idTecnico = 0;
    }

    if (this.idTecnico > 0) {
      this.cargarOrdenes();
    } else {
      this.cargando = false;
      this.error = '❌ No se pudo identificar al técnico. Inicie sesión nuevamente.';
      this.cdr.detectChanges();
    }
  }

  cargarOrdenes(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (data) => {
        this.ordenes = (data || []).filter(o => {
          const idTec = Number(o.idTecnico || o.id_tecnico || 0);
          return idTec === this.idTecnico && this.estadosVisibles.includes(o.estado);
        });

        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = '❌ Error al cargar las órdenes. Verifique la conexión.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  get ordenesFiltradas(): any[] {
    let resultado = this.ordenes;
    if (this.filtroEstado !== 'TODOS') {
      resultado = resultado.filter(o => o.estado === this.filtroEstado);
    }
    if (this.busqueda?.trim()) {
      const q = this.busqueda.toLowerCase().trim();
      resultado = resultado.filter(o => {
        const ticket = `OT-${o.idOrden}`.toLowerCase();
        const cliente = (o.nombreCliente || o.cliente || '').toLowerCase();
        const equipo = `${o.marca || ''} ${o.modelo || ''}`.toLowerCase();
        return ticket.includes(q) || cliente.includes(q) || equipo.includes(q) || 
               String(o.idOrden).includes(q);
      });
    }
    return resultado;
  }

  textoEstado(estado: string): string {
    const e: Record<string, string> = {
      'ASIGNADO': '👤 Asignado',
      'EN_PROCESO': '🔍 En diagnóstico',
      'COTIZADO': '💰 Cotizado',
      'COTIZACION_RECHAZADA_ADMIN': '❌ Cotización rechazada',
      'COTIZACION_APROBADA': '✅ Cotización aprobada',
      'EN_REPARACION': '🔧 En reparación',
      'EN_PRUEBAS': '🧪 En pruebas',
      'TERMINADO': '✅ Terminado',
      'ENTREGADO': '📦 Entregado'
    };
    return e[estado] || estado;
  }

  claseEstado(estado: string): string {
    const c: Record<string, string> = {
      'ASIGNADO': 'en-proceso',
      'EN_PROCESO': 'en-proceso',
      'COTIZADO': 'pendiente',
      'COTIZACION_RECHAZADA_ADMIN': 'pendiente',
      'COTIZACION_APROBADA': 'en-proceso',
      'EN_REPARACION': 'en-proceso',
      'EN_PRUEBAS': 'en-proceso',
      'TERMINADO': 'terminado',
      'ENTREGADO': 'terminado'
    };
    return c[estado] || 'pendiente';
  }

  getFecha(orden: any): string {
    const fechaRaw = orden.fechaInicio || orden.fecha_inicio || '';
    if (!fechaRaw) return 'Sin fecha';
    try {
      const fecha = new Date(fechaRaw);
      if (isNaN(fecha.getTime())) return fechaRaw;
      return fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return fechaRaw; }
  }

  recargar(): void {
    this.error = '';
    this.exito = '';
    this.cargarOrdenes();
  }
}