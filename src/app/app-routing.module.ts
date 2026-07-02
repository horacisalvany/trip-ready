import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { GroupComponent } from './views/group/group.component';
import { ListComponent } from './views/list/list.component';
import { ListsComponent } from './views/lists/lists.component';
import { LoginComponent } from './views/login/login.component';
import { MainMenuComponent } from './views/main-menu/main-menu.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: MainMenuComponent, canActivate: [AuthGuard] },
  { path: 'group', component: GroupComponent, canActivate: [AuthGuard] },
  { path: 'list', component: ListsComponent, canActivate: [AuthGuard] },
  { path: 'list/shared/:id', component: ListComponent, canActivate: [AuthGuard], data: { shared: true } },
  { path: 'list/:id', component: ListComponent, canActivate: [AuthGuard] },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
