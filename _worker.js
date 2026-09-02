export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const host = url.hostname.toLowerCase();

        if (host === "davirodrigues.pages.dev" || host.endsWith(".davirodrigues.pages.dev")) {
            url.hostname = "davirodrigues.dev";
            url.protocol = "https:";
            url.port = "";
            return Response.redirect(url.toString(), 301);
        }

        return env.ASSETS.fetch(request);
    },
};
