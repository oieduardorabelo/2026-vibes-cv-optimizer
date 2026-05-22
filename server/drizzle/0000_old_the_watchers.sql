CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`search_id` text NOT NULL,
	`title` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`salary` text DEFAULT '' NOT NULL,
	`remote` integer DEFAULT false,
	`match_score` integer,
	`match_analysis` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`search_id`) REFERENCES `searches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cv_content` text DEFAULT '' NOT NULL,
	`parsed_profile` text,
	`preferences` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `searches` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
