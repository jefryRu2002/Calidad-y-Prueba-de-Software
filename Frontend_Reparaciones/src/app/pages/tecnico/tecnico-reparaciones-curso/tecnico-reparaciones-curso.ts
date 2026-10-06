import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface Repuesto {
  nombre: string;
  cantidad: number;
  precio: number;
}

export interface Reparacion {
  id: number;
  ticket: string;
  equipo: string;
  cliente: string;
  estado: string;
  fechaIngreso: string;
  trabajosRealizados: string[];
  repuestos: Repuesto[];
  notas: string;
  puedePagar?: boolean;
}

@Component({
  selector: 'app-reparaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tecnico-reparaciones-curso.html',
  styleUrls: ['./tecnico-reparaciones-curso.css']
})
export class TecnicoReparacionesCurso implements OnInit {

  reparaciones: Reparacion[] = [];
  reparacionesFiltradas: Reparacion[] = [];
  ordenSeleccionada: Reparacion | null = null;
  cargando = true;
  error = '';
  exito = '';
  procesando = false;
  mostrarModalRepuesto = false;
  filtroActivo = 'todas';

  nuevoTrabajo = '';
  nuevoRepuesto = { nombre: '', cantidad: 1, precio: 0 };

  private apiUrl = 'http://localhost:8080/api';
  idTecnico = 0;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    this.idTecnico = Number(usuario.idPersona) || 0;
    if (this.idTecnico > 0) {
      this.cargarReparaciones();
    } else {
      this.cargando = false;
      this.error = '❌ No se pudo identificar al técnico';
      this.cdr.detectChanges();
    }
  }

  cargarReparaciones(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).subscribe({
      next: (data) => {
        // Órdenes del técnico en estado EN_REPARACION
        const delTecnico = (data || []).filter(ot => {
          const idTecnicoOrden = Number(ot.idTecnico || ot.id_tecnico || 0);
          return idTecnicoOrden === this.idTecnico && ot.estado === 'EN_REPARACION';
        });

        this.reparaciones = delTecnico.map(ot => ({
          id: ot.idOrden,
          ticket: 'OT-' + ot.idOrden,
          equipo: `${ot.marca || ''} ${ot.modelo || ''}`.trim() || 'Sin equipo',
          cliente: ot.nombreCliente || 'Sin cliente',
          estado: ot.estado,
          fechaIngreso: ot.fechaInicio || ot.fecha_inicio || '',
          trabajosRealizados: ot.trabajosRealizados || [],
          repuestos: ot.repuestosUsados || [],
          notas: ot.notasTecnico || '',
          puedePagar: ot.puedePagar || false
        }));

        this.reparacionesFiltradas = [...this.reparaciones];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = '❌ Error al cargar reparaciones';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarPorEstado(filtro: string): void {
    this.filtroActivo = filtro;
    this.reparacionesFiltradas = [...this.reparaciones];
    this.cdr.detectChanges();
  }

  seleccionarOrden(orden: any): void {
    this.ordenSeleccionada = orden;
    this.nuevoTrabajo = '';
    this.nuevoRepuesto = { nombre: '', cantidad: 1, precio: 0 };
    this.error = '';
    this.exito = '';
    this.cdr.detectChanges();
  }

  cerrarModal(): void {
    this.ordenSeleccionada = null;
    this.error = '';
    this.cdr.detectChanges();
  }

  abrirModalRepuesto(): void {
    this.nuevoRepuesto = { nombre: '', cantidad: 1, precio: 0 };
    this.mostrarModalRepuesto = true;
    this.cdr.detectChanges();
  }

  cerrarModalRepuesto(): void {
    this.mostrarModalRepuesto = false;
    this.cdr.detectChanges();
  }

  // ==================== TRABAJOS ====================
  agregarTrabajo(): void {
    if (!this.ordenSeleccionada || !this.nuevoTrabajo.trim()) return;
    if (!this.ordenSeleccionada.trabajosRealizados) {
      this.ordenSeleccionada.trabajosRealizados = [];
    }
    this.ordenSeleccionada.trabajosRealizados.push(this.nuevoTrabajo.trim());
    this.nuevoTrabajo = '';
    this.cdr.detectChanges();
  }

  quitarTrabajo(index: number): void {
    if (!this.ordenSeleccionada) return;
    this.ordenSeleccionada.trabajosRealizados.splice(index, 1);
    this.cdr.detectChanges();
  }

  // ==================== REPUESTOS ====================
  agregarRepuesto(): void {
    if (!this.ordenSeleccionada || !this.nuevoRepuesto.nombre.trim()) return;
    if (!this.ordenSeleccionada.repuestos) {
      this.ordenSeleccionada.repuestos = [];
    }
    this.ordenSeleccionada.repuestos.push({ ...this.nuevoRepuesto });
    this.nuevoRepuesto = { nombre: '', cantidad: 1, precio: 0 };
    this.mostrarModalRepuesto = false;
    this.cdr.detectChanges();
  }

  quitarRepuesto(index: number): void {
    if (!this.ordenSeleccionada) return;
    this.ordenSeleccionada.repuestos.splice(index, 1);
    this.cdr.detectChanges();
  }

  calcularTotalRepuestos(): number {
    if (!this.ordenSeleccionada?.repuestos) return 0;
    return this.ordenSeleccionada.repuestos.reduce((t, r) => t + (r.cantidad * r.precio), 0);
  }

  // ==================== GUARDAR (solo guarda, NO cambia estado) ====================
  guardar(): void {
    if (!this.ordenSeleccionada) return;

    this.procesando = true;
    this.error = '';
    this.exito = '';
    this.cdr.detectChanges();

    const datos = {
      trabajos: (this.ordenSeleccionada.trabajosRealizados || []).map(t => ({
        descripcion: t
      })),
      repuestos: (this.ordenSeleccionada.repuestos || []).map(r => ({
        nombre: r.nombre,
        cantidad: r.cantidad,
        precio: r.precio
      })),
      notas: this.ordenSeleccionada.notas || ''
    };

    this.http.put(`${this.apiUrl}/ordenes-trabajo/${this.ordenSeleccionada.id}/reparacion`, datos).subscribe({
      next: () => {
        this.exito = '✅ Reparación guardada correctamente';
        this.procesando = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.exito = ''; this.cdr.detectChanges(); }, 3000);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = err.error?.error || '❌ Error al guardar';
        this.procesando = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==================== AVANZAR A PRUEBAS (guarda + cambia estado) ====================
  avanzarAPruebas(): void {
    if (!this.ordenSeleccionada) return;

    if (!confirm('¿Avanzar a la fase de pruebas? Asegúrate de haber guardado los cambios.')) {
      return;
    }

    this.procesando = true;
    this.error = '';
    this.exito = '';
    this.cdr.detectChanges();

    // Primero guardar
    const datos = {
      trabajos: (this.ordenSeleccionada.trabajosRealizados || []).map(t => ({
        descripcion: t
      })),
      repuestos: (this.ordenSeleccionada.repuestos || []).map(r => ({
        nombre: r.nombre,
        cantidad: r.cantidad,
        precio: r.precio
      })),
      notas: this.ordenSeleccionada.notas || ''
    };

    this.http.put(`${this.apiUrl}/ordenes-trabajo/${this.ordenSeleccionada.id}/reparacion`, datos).subscribe({
      next: () => {
        // Después cambiar de estado
        this.http.put(`${this.apiUrl}/ordenes-trabajo/${this.ordenSeleccionada!.id}/avanzar-pruebas`, {}).subscribe({
          next: () => {
            this.exito = '✅ Orden pasada a pruebas';
            this.procesando = false;
            this.cdr.detectChanges();
            setTimeout(() => {
              this.exito = '';
              this.ordenSeleccionada = null;
              this.cargarReparaciones();
              this.cdr.detectChanges();
            }, 2000);
          },
          error: (err) => {
            console.error('❌ Error:', err);
            this.error = '❌ Error al avanzar a pruebas';
            this.procesando = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = '❌ Error al guardar antes de avanzar';
        this.procesando = false;
        this.cdr.detectChanges();
      }
    });
  }

  formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(monto || 0);
  }

  recargarDatos(): void {
    this.ordenSeleccionada = null;
    this.error = '';
    this.exito = '';
    this.cargarReparaciones();
  }
}