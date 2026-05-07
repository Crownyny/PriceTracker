import { Routes } from '@angular/router';
import { LandingComponent } from './features/landing/landing.component';
import { AuthGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { PriceHistoryComponent } from './features/price-history/components/price-history.component';
import { AlertsComponent } from './features/alerts/components/alerts.component';
import { LoginComponent } from './features/login/login.component';
import { RegisterComponent } from './features/register/register.component';
import { ForgotPasswordComponent } from './features/forgot-password/forgot-password.component';
import { SearchProductsComponent } from './features/search/search-products.component';
import { SavedProductsComponent } from './features/saved-products/saved-products.component';
import { ProductDetailComponent } from './features/products/components/product-detail.component';
import { AccountComponent } from './features/account/account.component';
import { EmailNotificationsComponent } from './features/email-notifications/email-notifications.component';
import { DocumentationComponent } from './features/documentation/documentation.component';
import { OpenProductComponent } from './features/open-product/open-product.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'register',
    component: RegisterComponent
  },
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'open-product',
    component: OpenProductComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'search',
    component: SearchProductsComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'saved',
    component: SavedProductsComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'product/:id',
    component: ProductDetailComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'price-history',
    component: PriceHistoryComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'alerts',
    component: AlertsComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'account',
    component: AccountComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'email-notifications',
    component: EmailNotificationsComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'documentation',
    component: DocumentationComponent,
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];