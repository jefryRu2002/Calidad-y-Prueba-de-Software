import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-orden-trabajo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './administrador-orden-trabajo.html',
  styleUrls: ['./administrador-orden-trabajo.css']
})
export class AdministradorOrdenTrabajo implements OnInit, OnDestroy {

  estadoFiltro = 'Todos';
  busquedaCliente = '';
  mostrarModalEditar = false;
  ordenSeleccionada: any = {};
  ordenes: any[] = [];
  tecnicos: any[] = [];
  cargando = false;
  error = '';
  actualizando = false;
  exito = '';

  private apiUrl = 'http://localhost:8080/api';
  private intervaloActualizacion: any;

  // Estados oficiales (sin PENDIENTE)
  estadosOrden = [
    'ASIGNADO',
    'EN_PROCESO',
    'COTIZADO',
    'COTIZACION_RECHAZADA_ADMIN',
    'COTIZACION_APROBADA',
    'EN_REPARACION',
    'EN_PRUEBAS',
    'TERMINADO',
    'ENTREGADO',
    'DEVUELTO'
  ];

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarDatosIniciales();
    this.iniciarAutoActualizacion();
  }

  ngOnDestroy(): void {
    this.detenerAutoActualizacion();
  }

  iniciarAutoActualizacion(): void {
    this.intervaloActualizacion = setInterval(() => {
      this.cargarOrdenes(false);
    }, 30000);
  }

  detenerAutoActualizacion(): void {
    if (this.intervaloActualizacion) {
      clearInterval(this.intervaloActualizacion);
      this.intervaloActualizacion = null;
    }
  }

  cargarDatosIniciales(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/tecnicos`).subscribe({
      next: (data) => {
        this.procesarTecnicos(data || []);
        this.cargarOrdenes(true);
      },
      error: () => {
        this.cargarOrdenes(true);
      }
    });
  }

  recargarTodo(): void {
    if (this.actualizando) return;
    
    this.actualizando = true;
    this.error = '';
    this.exito = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (data) => {
        this.procesarOrdenes(data || []);
        this.actualizando = false;
        this.exito = '✅ Datos actualizados correctamente';
        this.cdr.detectChanges();
        setTimeout(() => { this.exito = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: () => {
        this.error = '❌ Error al actualizar. Verifique la conexión.';
        this.actualizando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cargarOrdenes(mostrarLoader: boolean = true): void {
    if (mostrarLoader) {
      this.cargando = true;
      this.error = '';
      this.cdr.detectChanges();
    }

    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (data) => {
        this.procesarOrdenes(data || []);
        if (mostrarLoader) {
          this.cargando = false;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = '❌ Error al cargar órdenes';
        if (mostrarLoader) {
          this.cargando = false;
        }
        this.cdr.detectChanges();
      }
    });
  }

  procesarTecnicos(data: any[]): void {
    this.tecnicos = data.map(t => {
      let nombre = '';
      if (t.persona && typeof t.persona === 'object') {
        nombre = (t.persona.nombre || t.persona.nombres || '') + ' ' + 
                 (t.persona.apellido || t.persona.apellidos || '');
      } else if (t.nombreCompleto || t.nombre_completo) {
        nombre = t.nombreCompleto || t.nombre_completo;
      } else {
        nombre = (t.nombre || '') + ' ' + (t.apellido || '');
      }
      return {
        id: t.idPersona || t.id_persona || t.id,
        nombre: nombre.trim() || 'Técnico #' + (t.idPersona || t.id)
      };
    });
  }

  procesarOrdenes(data: any[]): void {
    // 🔥 Filtrar órdenes en estado PENDIENTE (no se muestran aquí)
    const ordenesFiltradas = (data || []).filter(ot => 
      ot.estado && ot.estado !== 'PENDIENTE'
    );

    this.ordenes = ordenesFiltradas.map(ot => {
      let nombreCliente = ot.nombreCliente || ot.nombre_cliente || '';
      if (!nombreCliente) {
        nombreCliente = 'Cliente #' + (ot.idCliente || ot.idPersona || 'N/A');
      }

      const marcaEquipo = ot.marca || '';
      const modeloEquipo = ot.modelo || '';
      const descripcion = ot.descripcion || ot.descripcionFalla || 'Sin descripción';

      const idTecnico = ot.idTecnico || ot.id_tecnico || '';
      let nombreTecnico = 'No asignado';
      if (idTecnico) {
        const t = this.tecnicos.find(tec => tec.id == idTecnico);
        nombreTecnico = t ? t.nombre : (ot.nombreTecnico || 'Técnico #' + idTecnico);
      }

      return {
        id: 'OT-' + ot.idOrden,
        idOrden: ot.idOrden,
        ticket: 'TK-' + (ot.idTicket || ot.idReporte || 'N/A'),
        cliente: nombreCliente,
        marca: marcaEquipo,
        modelo: modeloEquipo,
        equipoCompleto: [marcaEquipo, modeloEquipo].filter(Boolean).join(' ') || 'Sin equipo',
        descripcion: descripcion,
        tecnico: nombreTecnico,
        idTecnico: idTecnico,
        fechaInicio: ot.fechaInicio || ot.fecha_inicio || '',
        fechaFin: ot.fechaFin || ot.fecha_fin || '',
        fechaAsignacion: ot.fechaAsignacion || ot.fecha_asignacion || '',
        estado: ot.estado || 'ASIGNADO',
        puedePagar: ot.puedePagar || false,
        notasTecnico: ot.notasTecnico || '',
        trabajosRealizados: ot.trabajosRealizados || [],
        repuestosUsados: ot.repuestosUsados || []
      };
    });

    this.ordenes.sort((a, b) => b.idOrden - a.idOrden);
  }

  // ==================== ESTADOS ====================
  getEstadoBadge(estado: string): string {
    const badges: Record<string, string> = {
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
    return badges[estado] || estado;
  }

  getEstadoClass(estado: string): string {
    const clases: Record<string, string> = {
      'ASIGNADO': 'proceso',
      'EN_PROCESO': 'proceso',
      'COTIZADO': 'pendiente',
      'COTIZACION_RECHAZADA_ADMIN': 'cancelado',
      'COTIZACION_APROBADA': 'terminado',
      'EN_REPARACION': 'proceso',
      'EN_PRUEBAS': 'proceso',
      'TERMINADO': 'terminado',
      'ENTREGADO': 'entregado',
      'DEVUELTO': 'cancelado'
    };
    return clases[estado] || '';
  }

  // ==================== FILTROS ====================
  get ordenesFiltradas() {
    let f = this.ordenes;
    const q = this.busquedaCliente.toLowerCase().trim();
    if (q) {
      f = f.filter(o => 
        o.cliente.toLowerCase().includes(q) || 
        o.id.toLowerCase().includes(q) || 
        o.ticket.toLowerCase().includes(q) ||
        o.tecnico.toLowerCase().includes(q) ||
        o.descripcion.toLowerCase().includes(q)
      );
    }
    if (this.estadoFiltro !== 'Todos') {
      f = f.filter(o => o.estado === this.estadoFiltro);
    }
    return f;
  }

  // ==================== MODAL EDITAR ====================
  abrirModalEditar(orden: any): void {
    this.ordenSeleccionada = { 
      ...orden,
      _teniaTecnico: !!orden.idTecnico
    };
    this.mostrarModalEditar = true;
    this.cdr.detectChanges();
  }

  cerrarModalEditar(): void {
    this.mostrarModalEditar = false;
    this.cdr.detectChanges();
  }

  guardarCambios(): void {
    const datos: any = {
      estado: this.ordenSeleccionada.estado
    };

    if (this.ordenSeleccionada.idTecnico) {
      datos.idTecnico = this.ordenSeleccionada.idTecnico;
    }

    this.http.put(`${this.apiUrl}/ordenes-trabajo/${this.ordenSeleccionada.idOrden}`, datos).subscribe({
      next: () => {
        this.exito = '✅ Cambios guardados correctamente';
        this.cerrarModalEditar();
        this.recargarTodo();
        this.cdr.detectChanges();
        setTimeout(() => { this.exito = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.error = '❌ Error: ' + (err.error?.error || 'No se pudo actualizar');
        this.cdr.detectChanges();
      }
    });
  }

  eliminarOrden(orden: any): void {
    if (!confirm(`¿Estás seguro de eliminar la orden ${orden.id}?\n\nEsta acción no se puede deshacer.`)) return;
    
    this.http.delete(`${this.apiUrl}/ordenes-trabajo/${orden.idOrden}`).subscribe({
      next: () => {
        this.exito = '✅ Orden eliminada correctamente';
        this.recargarTodo();
        this.cdr.detectChanges();
        setTimeout(() => { this.exito = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        this.error = '❌ Error: ' + (err.error?.error || 'No se pudo eliminar');
        this.cdr.detectChanges();
      }
    });
  }
}