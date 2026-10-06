import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-recuperar-contrasena',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recuperar-contrasena.html',
  styleUrl: './recuperar-contrasena.css',
})
export class RecuperarContrasena {   // ← OJO: nombre de clase
  contrasena = '';
  confirmar = '';
  token = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {
    this.token = this.route.snapshot.queryParams['token'];
  }

  restablecer() {
    if (this.contrasena !== this.confirmar) {
      return alert('Las contraseñas no coinciden');
    }

    this.http.post('http://localhost:8080/api/auth/restablecer-contrasena', {
      token: this.token,
      contrasena: this.contrasena
    }).subscribe({
      next: () => {
        alert('Contraseña actualizada. Ya puedes iniciar sesión.');
        this.router.navigate(['/']);
      },
      error: () => alert('Error al restablecer')
    });
  }
}