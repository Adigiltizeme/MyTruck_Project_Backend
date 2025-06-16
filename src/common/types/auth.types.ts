export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    magasinId?: string;
    iat?: number;
    exp?: number;
}

export interface AuthenticatedUser {
    id: string;
    email: string;
    nom: string;
    prenom?: string;
    role: string;
    magasinId?: string;
    magasin?: {
        id: string;
        nom: string;
    };
}