FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

# The .NET 9 aspnet image already has 'app' user/group created
# Just ensure the app directory is owned by the app user
RUN chown -R app:app /app

COPY --from=build --chown=app:app /app/publish .

# Switch to non-root user (already exists in .NET 9 base image)
USER app

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "DigiTransac.Api.dll"]
