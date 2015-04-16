/*
   jueves, 16 de abril de 201511:43:11
   User: 
   Server: localhost\SQLEXPRESS
   Database: loconomics
   Application: 
*/

/* To prevent any potential data loss issues, you should review this script in detail before running it outside the context of the database designer.*/
BEGIN TRANSACTION
SET QUOTED_IDENTIFIER ON
SET ARITHABORT ON
SET NUMERIC_ROUNDABORT OFF
SET CONCAT_NULL_YIELDS_NULL ON
SET ANSI_NULLS ON
SET ANSI_PADDING ON
SET ANSI_WARNINGS ON
COMMIT
BEGIN TRANSACTION
GO
CREATE TABLE dbo.Tmp_userprofile
	(
	UserId int NOT NULL IDENTITY (1, 1),
	Email nvarchar(254) NOT NULL
	)  ON [PRIMARY]
GO
ALTER TABLE dbo.Tmp_userprofile SET (LOCK_ESCALATION = TABLE)
GO
SET IDENTITY_INSERT dbo.Tmp_userprofile ON
GO
IF EXISTS(SELECT * FROM dbo.userprofile)
	 EXEC('INSERT INTO dbo.Tmp_userprofile (UserId, Email)
		SELECT UserId, Email FROM dbo.userprofile WITH (HOLDLOCK TABLOCKX)')
GO
SET IDENTITY_INSERT dbo.Tmp_userprofile OFF
GO
ALTER TABLE dbo.webpages_UsersInRoles
	DROP CONSTRAINT fk_UserId
GO
DROP TABLE dbo.userprofile
GO
EXECUTE sp_rename N'dbo.Tmp_userprofile', N'userprofile', 'OBJECT' 
GO
ALTER TABLE dbo.userprofile ADD CONSTRAINT
	PK__userprof__1788CC4C023D5A04 PRIMARY KEY CLUSTERED 
	(
	UserId
	) WITH( STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]

GO
ALTER TABLE dbo.userprofile ADD CONSTRAINT
	UQ__userprof__C9F284560519C6AF UNIQUE NONCLUSTERED 
	(
	Email
	) WITH( STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]

GO
COMMIT
select Has_Perms_By_Name(N'dbo.userprofile', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.userprofile', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.userprofile', 'Object', 'CONTROL') as Contr_Per BEGIN TRANSACTION
GO
ALTER TABLE dbo.webpages_UsersInRoles ADD CONSTRAINT
	fk_UserId FOREIGN KEY
	(
	UserId
	) REFERENCES dbo.userprofile
	(
	UserId
	) ON UPDATE  NO ACTION 
	 ON DELETE  NO ACTION 
	
GO
ALTER TABLE dbo.webpages_UsersInRoles SET (LOCK_ESCALATION = TABLE)
GO
COMMIT
select Has_Perms_By_Name(N'dbo.webpages_UsersInRoles', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.webpages_UsersInRoles', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.webpages_UsersInRoles', 'Object', 'CONTROL') as Contr_Per 