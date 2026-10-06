import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface SolicitudDashboard {
  id: number;
  codigo: string;
  equipo: string;
  tipo: string;
  estado: string;
  fecha: string;
  descripcion: string;
}

@Component({
  selector: 'app-cliente-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cliente-dashboard.html',
  styleUrls: ['./cliente-dashboard.css']
})
export class ClienteDashboard implements OnInit {

  clienteId: number = 0;
  nombreCliente = signal('Cliente');
  email = signal('Cargando...');
  telefono = signal('Cargando...');

  totalSolicitudes = signal(0);
  solicitudesPendientes = signal(0);
  solicitudesEnProceso = signal(0);
  solicitudesTerminadas = signal(0);

  ultimasSolicitudes = signal<SolicitudDashboard[]>([]);
  cargando = signal(true);
  errorCarga = signal(false);
  mensajeError = signal('');

  porcentajeCompletadas = computed(() => {
    const total = this.totalSolicitudes();
    const terminadas = this.solicitudesTerminadas();
    return total > 0 ? Math.round((terminadas / total) * 100) : 0;
  });

  porcentajeEnProceso = computed(() => {
    const total = this.totalSolicitudes();
    const enProceso = this.solicitudesEnProceso();
    return total > 0 ? Math.round((enProceso / total) * 100) : 0;
  });

  private apiUrl = 'http://localhost:8080/api';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.cargarDatosUsuario();
  }

  private cargarDatosUsuario(): void {
    try {
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      this.clienteId = Number(usuario.idPersona || usuario.id_persona || usuario.id || 0);
      this.nombreCliente.set(usuario.nombre || usuario.nombreCliente || 'Cliente');
    } catch (error) {
      this.clienteId = 0;
    }
  }

  ngOnInit(): void {
    if (!this.clienteId || this.clienteId === 0) {
      this.mensajeError.set('No se encontró información del cliente. Por favor, inicia sesión nuevamente.');
      this.errorCarga.set(true);
      this.cargando.set(false);
      return;
    }
    this.cargarDashboard();
  }

  cargarDashboard(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);

    // Cargar datos personales
    this.http.get<any>(`${this.apiUrl}/personas/${this.clienteId}`).subscribe({
      next: (persona) => {
        this.email.set(persona.correo || persona.email || 'No disponible');
        this.telefono.set(persona.telefono || 'No disponible');
        this.nombreCliente.set(persona.nombre || this.nombreCliente());
        this.cargarOrdenes();
      },
      error: () => {
        this.cargarOrdenes();
      }
    });
  }

  private cargarOrdenes(): void {
    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (ordenes) => {
        // Filtrar órdenes de este cliente
        const misOrdenes = (ordenes || []).filter(o => {
          const idCliente = Number(o.idCliente || o.idPersona || o.id_cliente || o.id_persona || 0);
          return idCliente === this.clienteId;
        });

        this.totalSolicitudes.set(misOrdenes.length);
        this.solicitudesPendientes.set(
          misOrdenes.filter(o => 
            o.estado === 'PENDIENTE' || o.estado === 'ASIGNADO' || o.estado === 'EN_PROCESO'
          ).length
        );
        this.solicitudesEnProceso.set(
          misOrdenes.filter(o => 
            o.estado === 'COTIZADO' || o.estado === 'COTIZACION_APROBADA' ||
            o.estado === 'EN_REPARACION' || o.estado === 'EN_PRUEBAS'
          ).length
        );
        this.solicitudesTerminadas.set(
          misOrdenes.filter(o => 
            o.estado === 'TERMINADO' || o.estado === 'ENTREGADO'
          ).length
        );

        // Últimas 5
        const ultimas = misOrdenes
          .sort((a, b) => {
            const fechaA = new Date(b.fechaInicio || 0).getTime();
            const fechaB = new Date(a.fechaInicio || 0).getTime();
            return fechaA - fechaB;
          })
          .slice(0, 5)
          .map(o => ({
            id: o.idOrden || 0,
            codigo: 'OT-' + (o.idOrden || 0),
            equipo: (o.marca || '') + ' ' + (o.modelo || ''),
            tipo: o.tipoEquipo || o.tipo_equipo || 'N/A',
            estado: this.textoEstado(o.estado),
            fecha: this.formatearFecha(o.fechaInicio),
            descripcion: o.descripcion || o.descripcionFalla || ''
          }));

        this.ultimasSolicitudes.set(ultimas);
        this.cargando.set(false);
      },
      error: (err) => {
        this.mensajeError.set('Error al cargar los datos.');
        this.errorCarga.set(true);
        this.cargando.set(false);
      }
    });
  }

  textoEstado(estado: string): string {
    const map: Record<string, string> = {
      'PENDIENTE': '⏳ Pendiente',
      'ASIGNADO': '👤 Asignado',
      'EN_PROCESO': '🔍 En diagnóstico',
      'COTIZADO': '⏳ Preparando cotización',
      'COTIZACION_RECHAZADA_ADMIN': '⏳ Preparando cotización',
      'COTIZACION_APROBADA': '💰 Cotización disponible',
      'EN_REPARACION': '🔧 En reparación',
      'EN_PRUEBAS': '🧪 En pruebas',
      'TERMINADO': '✅ Listo para recoger',
      'ENTREGADO': '📦 Entregado',
      'DEVUELTO': '↩️ Devuelto'
    };
    return map[estado] || estado || 'Pendiente';
  }

  getEstadoClase(estado: string): string {
    if (estado.includes('Pendiente') || estado.includes('Asignado') || estado.includes('diagnóstico')) return 'estado-pendiente';
    if (estado.includes('reparación') || estado.includes('pruebas') || estado.includes('preparando') || estado.includes('disponible')) return 'estado-proceso';
    if (estado.includes('Listo') || estado.includes('recoger')) return 'estado-terminado';
    if (estado.includes('Entregado')) return 'estado-entregado';
    if (estado.includes('Devuelto')) return 'estado-cancelado';
    return 'estado-pendiente';
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'Sin fecha';
    try {
      const fechaObj = new Date(fecha);
      if (isNaN(fechaObj.getTime())) return fecha;
      return fechaObj.toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  }

  verSolicitud(id: number): void {
    this.router.navigate(['/cliente/estado-solicitud']);
  }

  verTodasSolicitudes(): void {
    this.router.navigate(['/cliente/estado-solicitud']);
  }

  nuevaSolicitud(): void {
    this.router.navigate(['/cliente/generar-solicitud']);
  }

  recargarDashboard(): void {
    this.cargarDashboard();
  }

  cerrarSesion(): void {
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }
}