import {
    WebSocketGateway as WSGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@WSGateway({
    cors: {
        origin: '*',
    },
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private connectedUsers = new Map<string, Socket>();

    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
        // Supprimer de la map des utilisateurs connectés
        for (const [userId, socket] of this.connectedUsers.entries()) {
            if (socket.id === client.id) {
                this.connectedUsers.delete(userId);
                break;
            }
        }
    }

    @SubscribeMessage('join-room')
    handleJoinRoom(
        @MessageBody() data: { userId: string; userType: string },
        @ConnectedSocket() client: Socket,
    ) {
        const roomName = `${data.userType}-${data.userId}`;
        client.join(roomName);
        this.connectedUsers.set(data.userId, client);
        console.log(`User ${data.userId} joined room ${roomName}`);
    }

    @SubscribeMessage('location-update')
    handleLocationUpdate(
        @MessageBody() data: { chauffeurId: string; latitude: number; longitude: number },
        @ConnectedSocket() client: Socket,
    ) {
        // Diffuser la position aux magasins intéressés
        this.server.to('magasin').emit('chauffeur-location', data);
    }

    // Méthodes utilitaires pour envoyer des notifications
    sendToUser(userId: string, event: string, data: any) {
        const socket = this.connectedUsers.get(userId);
        if (socket) {
            socket.emit(event, data);
        }
    }

    sendToRole(role: string, event: string, data: any) {
        this.server.to(role).emit(event, data);
    }

    broadcastCommandeUpdate(commandeId: string, update: any) {
        this.server.emit('commande-update', { commandeId, ...update });
    }
}