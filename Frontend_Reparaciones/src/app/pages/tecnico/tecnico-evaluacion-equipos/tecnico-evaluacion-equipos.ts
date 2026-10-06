import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-evaluaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tecnico-evaluacion-equipos.html',
  styleUrls: ['./tecnico-evaluacion-equipos.css']
})
export class TecnicoEvaluacionEquipos implements OnInit {
  
  tickets: any[] = [];
  ticketsFiltrados: any[] = [];
  ticketSeleccionado: any = null;
  guardado = false;
  error = '';
  exito = '';
  cargando = false;
  procesando = false;
  busqueda = '';
  
  evaluacion = {
    procesador: '', ram: '', almacenamiento: '',
    sistemaOperativo: '', detallesRevision: ''
  };
  
  private apiUrl = 'http://localhost:8080/api';
  idTecnico: number = 0;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    this.idTecnico = Number(usuario.idPersona || usuario.id || 0);
    
    if (this.idTecnico > 0) {
      this.cargarOrdenes();
    } else {
      this.error = '❌ No se pudo identificar al técnico.';
    }
  }

  cargarOrdenes(): void {
    this.cargando = true;
    this.error = '';
    this.cdr.detectChanges();

    forkJoin({
      ordenes: this.http.get<any[]>(`${this.apiUrl}/ordenes-trabajo`).pipe(catchError(() => of([]))),
      evaluaciones: this.http.get<any[]>(`${this.apiUrl}/evaluaciones`).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ ordenes, evaluaciones }) => {
        // IDs que ya tienen evaluación
        const idsConEvaluacion = new Set<number>();
        evaluaciones.forEach(e => {
          const idOrden = Number(e.orden_trabajo_id || e.ordenTrabajoId || 0);
          if (idOrden > 0) idsConEvaluacion.add(idOrden);
        });

        // Órdenes del técnico en estado ASIGNADO sin evaluación
        const delTecnico = (ordenes || []).filter(o => {
          const idTec = Number(o.idTecnico || o.id_tecnico || 0);
          return idTec === this.idTecnico && o.estado === 'ASIGNADO';
        });

        this.tickets = delTecnico
          .filter(o => !idsConEvaluacion.has(Number(o.idOrden)))
          .map(o => ({
            id: o.idOrden,
            ticket: 'OT-' + o.idOrden,
            cliente: o.nombreCliente || 'Sin cliente',
            equipo: `${o.marca || ''} ${o.modelo || ''}`.trim(),
            marca: o.marca || '', modelo: o.modelo || '',
            estado: o.estado || 'ASIGNADO',
            descripcion: o.descripcion || o.descripcionFalla || '',
            fechaInicio: o.fechaInicio || ''
          }));

        this.ticketsFiltrados = [...this.tickets];
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

  seleccionarParaEvaluar(ticket: any): void {
    this.ticketSeleccionado = ticket;
    this.guardado = false;
    this.error = '';
    this.exito = '';
    this.evaluacion = { procesador: '', ram: '', almacenamiento: '', sistemaOperativo: '', detallesRevision: '' };
    this.cdr.detectChanges();
  }

  cerrarEvaluacion(): void {
    this.ticketSeleccionado = null;
    this.error = '';
    this.guardado = false;
    this.cdr.detectChanges();
  }

  guardarEvaluacion(): void {
    if (!this.ticketSeleccionado) {
      this.error = '⚠️ Selecciona una orden de trabajo.';
      this.cdr.detectChanges();
      return;
    }
    if (!this.evaluacion.detallesRevision?.trim()) {
      this.error = '⚠️ Los detalles de revisión son obligatorios.';
      this.cdr.detectChanges();
      return;
    }

    this.procesando = true;
    this.error = '';
    this.cdr.detectChanges();

    this.http.post(`${this.apiUrl}/evaluaciones`, {
      orden_trabajo_id: this.ticketSeleccionado.id,
      tecnico_id: this.idTecnico,
      procesador: this.evaluacion.procesador || '',
      ram: this.evaluacion.ram || '',
      almacenamiento: this.evaluacion.almacenamiento || '',
      sistema_operativo: this.evaluacion.sistemaOperativo || '',
      detalles_revision: this.evaluacion.detallesRevision.trim()
    }).subscribe({
      next: () => {
        // 🔥 El backend ya cambió la orden a EN_PROCESO
        this.guardado = true;
        this.exito = '✅ Evaluación guardada. Orden en proceso de cotización.';
        this.procesando = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          this.exito = '';
          this.ticketSeleccionado = null;
          this.cargarOrdenes();
          this.cdr.detectChanges();
        }, 2000);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error = err.error?.error || '❌ Error al guardar la evaluación.';
        this.procesando = false;
        this.cdr.detectChanges();
        setTimeout(() => { this.error = ''; this.cdr.detectChanges(); }, 5000);
      }
    });
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return 'Sin fecha';
    try { 
      return new Date(fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }); 
    } catch { 
      return fecha; 
    }
  }
}