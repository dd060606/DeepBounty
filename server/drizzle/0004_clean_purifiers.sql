CREATE TYPE "public"."notification_provider" AS ENUM('discord', 'ntfysh');--> statement-breakpoint
CREATE TABLE "notification_services" (
	"provider" "notification_provider" PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL
);
