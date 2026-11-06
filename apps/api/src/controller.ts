import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  clientSchema,
  projectSchema,
  taskSchema,
  taskUpdateSchema,
  statusSchema,
  versionSchema,
  organizationSchema,
  memberSchema,
  memberUpdateSchema,
  listQuery,
  type ClientInput,
  type ProjectInput,
  type TaskInput,
  type TaskUpdateInput,
  type StatusInput,
  type Role,
  type ListQuery,
} from "@flowdesk/contracts";
import { AuthGuard, type AuthRequest } from "./auth";
import { WorkspaceService } from "./workspace";
import { ZodPipe } from "./http";
@Controller("organizations")
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(
    @Inject(WorkspaceService) private readonly service: WorkspaceService,
  ) {}
  @Get() organizations(@Req() r: AuthRequest) {
    return this.service.organizations(r.identity);
  }
  @Post() create(
    @Req() r: AuthRequest,
    @Body(new ZodPipe(organizationSchema)) d: { name: string },
  ) {
    return this.service.createOrganization(r.identity, d.name);
  }
  @Get(":org") organization(@Req() r: AuthRequest, @Param("org") org: string) {
    return this.service.organization(r.identity, org);
  }
  @Patch(":org") update(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Body(new ZodPipe(organizationSchema)) d: { name: string },
  ) {
    return this.service.updateOrganization(r.identity, org, d.name);
  }
  @Get(":org/dashboard") dashboard(
    @Req() r: AuthRequest,
    @Param("org") org: string,
  ) {
    return this.service.dashboard(r.identity, org);
  }
  @Get(":org/members") members(
    @Req() r: AuthRequest,
    @Param("org") org: string,
  ) {
    return this.service.members(r.identity, org);
  }
  @Post(":org/members") addMember(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Body(new ZodPipe(memberSchema)) d: { email: string; role: Role },
  ) {
    return this.service.addMember(r.identity, org, d.email, d.role);
  }
  @Patch(":org/members/:id") memberRole(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body(new ZodPipe(memberUpdateSchema)) d: { role: Role },
  ) {
    return this.service.changeMember(r.identity, org, id, d.role);
  }
  @Delete(":org/members/:id") removeMember(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.service.changeMember(r.identity, org, id);
  }
  @Get(":org/clients") clients(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Query(new ZodPipe(listQuery)) q: ListQuery,
  ) {
    return this.service.listClients(r.identity, org, q);
  }
  @Get(":org/clients/:id") client(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.service.getClient(r.identity, org, id);
  }
  @Post(":org/clients") createClient(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Body(new ZodPipe(clientSchema)) d: ClientInput,
  ) {
    return this.service.saveClient(r.identity, org, d);
  }
  @Put(":org/clients/:id") updateClient(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body(new ZodPipe(clientSchema)) d: ClientInput,
  ) {
    return this.service.saveClient(r.identity, org, d, id);
  }
  @Delete(":org/clients/:id") deleteClient(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.service.deleteClient(r.identity, org, id);
  }
  @Get(":org/projects") projects(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Query(new ZodPipe(listQuery)) q: ListQuery,
  ) {
    return this.service.listProjects(r.identity, org, q);
  }
  @Get(":org/projects/:id") project(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.service.getProject(r.identity, org, id);
  }
  @Post(":org/projects") createProject(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Body(new ZodPipe(projectSchema)) d: ProjectInput,
  ) {
    return this.service.saveProject(r.identity, org, d);
  }
  @Put(":org/projects/:id") updateProject(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body(new ZodPipe(projectSchema)) d: ProjectInput,
  ) {
    return this.service.saveProject(r.identity, org, d, id);
  }
  @Get(":org/tasks") tasks(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Query(new ZodPipe(listQuery)) q: ListQuery,
  ) {
    return this.service.listTasks(r.identity, org, q);
  }
  @Get(":org/tasks/:id") task(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
  ) {
    return this.service.getTask(r.identity, org, id);
  }
  @Post(":org/tasks") createTask(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Body(new ZodPipe(taskSchema)) d: TaskInput,
  ) {
    return this.service.saveTask(r.identity, org, d);
  }
  @Put(":org/tasks/:id") updateTask(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body(new ZodPipe(taskUpdateSchema)) d: TaskUpdateInput,
  ) {
    return this.service.saveTask(r.identity, org, d, id);
  }
  @Patch(":org/tasks/:id/status") status(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body(new ZodPipe(statusSchema)) d: StatusInput,
  ) {
    return this.service.status(r.identity, org, id, d);
  }
  @Delete(":org/tasks/:id") deleteTask(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Param("id") id: string,
    @Body(new ZodPipe(versionSchema)) d: { version: number },
  ) {
    return this.service.deleteTask(r.identity, org, id, d.version);
  }
  @Get(":org/activity") activity(
    @Req() r: AuthRequest,
    @Param("org") org: string,
    @Query(new ZodPipe(listQuery)) q: ListQuery,
  ) {
    return this.service.activity(r.identity, org, q);
  }
}
