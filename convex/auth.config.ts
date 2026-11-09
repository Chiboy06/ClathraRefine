// Clerk issues a JWT from the template named "convex" carrying {"role": "{{user.public_metadata.role}}"}.
// CLERK_JWT_ISSUER_DOMAIN is set on the Convex deployment (npx convex env set).
export default {
  providers: [{ domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, applicationID: "convex" }],
};
