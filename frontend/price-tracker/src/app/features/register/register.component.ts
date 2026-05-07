import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  loading      = false;
  error: string | null = null;
  showPassword = false;
  showConfirm  = false;
  readonly form;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private route:  ActivatedRoute,
    private router: Router
  ) {
    this.form = this.formBuilder.group({
      name:            [''],
      email:           ['', [Validators.required, Validators.email]],
      password:        ['', [Validators.required, Validators.minLength(8), this.passwordPolicyValidator]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: [this.passwordsMatchValidator] });
  }

  // ── Getters para el template ──────────────────────────────────────────────

  get pwd() { return this.form.get('password'); }
  get pwdValue(): string { return String(this.pwd?.value || ''); }

  get hasMin8():   boolean { return this.pwdValue.length >= 8; }
  get hasUpper():  boolean { return /[A-Z]/.test(this.pwdValue); }
  get hasNumber(): boolean { return /\d/.test(this.pwdValue); }
  get hasSymbol(): boolean { return /[^A-Za-z0-9]/.test(this.pwdValue); }
  get pwdStrength(): number {
    return [this.hasMin8, this.hasUpper, this.hasNumber, this.hasSymbol].filter(Boolean).length;
  }
  get strengthLabel(): string {
    const map = ['', 'Muy débil', 'Débil', 'Buena', 'Fuerte'];
    return this.pwdValue ? map[this.pwdStrength] : '';
  }
  get strengthColor(): string {
    const map = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];
    return this.pwdValue ? map[this.pwdStrength] : '#e5e7eb';
  }

  get passwordsMatch(): boolean {
    const confirm = this.form.get('confirmPassword')?.value;
    return !!confirm && this.pwdValue === confirm;
  }

  get confirmTouched(): boolean {
    return !!this.form.get('confirmPassword')?.touched;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error = this.resolveFormError();
      return;
    }

    this.loading = true;
    this.error   = null;

    const { email, password, name } = this.form.getRawValue() as
      { email: string; password: string; name?: string };

    this.authService.register({ email, password, displayName: name }).pipe(
      catchError(err => { this.error = this.mapAuthError(err); return of(null); }),
      finalize(() => { this.loading = false; })
    ).subscribe(response => {
      if (!response) return;
      this.navigateToReturnUrl();
    });
  }

  onGoogle(): void {
    this.loading = true;
    this.error   = null;
    this.authService.loginWithGoogle().pipe(
      catchError(err => { this.error = this.mapAuthError(err); return of(null); }),
      finalize(() => { this.loading = false; })
    ).subscribe(response => {
      if (!response) return;
      this.navigateToReturnUrl();
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private navigateToReturnUrl(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    const safeUrl = returnUrl.startsWith('/') ? returnUrl : '/dashboard';
    this.router.navigateByUrl(safeUrl);
  }

  private passwordsMatchValidator = (group: any) => {
    const password = group?.get?.('password')?.value;
    const confirm  = group?.get?.('confirmPassword')?.value;
    return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
  };

  private passwordPolicyValidator = (control: any) => {
    const value = String(control?.value || '');
    if (!value) return null;
    const ok = /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
    return ok ? null : { passwordPolicy: true };
  };

  private resolveFormError(): string {
    if (this.form.errors?.['passwordMismatch'])   return 'Las contraseñas no coinciden';
    const email = this.form.get('email');
    if (email?.errors?.['required'])              return 'El email es obligatorio';
    if (email?.errors?.['email'])                 return 'El email no tiene un formato válido';
    const password = this.form.get('password');
    if (password?.errors?.['required'])           return 'La contraseña es obligatoria';
    if (password?.errors?.['minlength'])          return 'La contraseña debe tener al menos 8 caracteres';
    if (password?.errors?.['passwordPolicy'])     return 'La contraseña debe incluir mayúscula, número y símbolo';
    return 'Revisa los campos del formulario';
  }

  private mapAuthError(err: any): string {
    const code = err?.code as string | undefined;
    if (code === 'auth/email-already-in-use') return 'Este correo electrónico ya está registrado';
    if (code === 'auth/invalid-email')        return 'El correo electrónico no es válido';
    if (code === 'auth/weak-password')        return 'La contraseña es demasiado débil';
    if (code === 'auth/popup-closed-by-user') return 'Cerraste la ventana de Google antes de completar';
    return 'No fue posible completar el registro. Inténtalo de nuevo.';
  }
}