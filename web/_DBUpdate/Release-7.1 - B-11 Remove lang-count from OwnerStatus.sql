/*
   martes, 12 de enero de 201613:57:24
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
ALTER TABLE dbo.OwnerStatus
	DROP CONSTRAINT PK__OwnerSta__2EFF691C7405149D
GO
ALTER TABLE dbo.OwnerStatus ADD CONSTRAINT
	PK_OwnerStatus PRIMARY KEY CLUSTERED 
	(
	OwnserStatusID
	) WITH( STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]

GO
ALTER TABLE dbo.OwnerStatus
	DROP COLUMN LanguageID, CountryID
GO
ALTER TABLE dbo.OwnerStatus SET (LOCK_ESCALATION = TABLE)
GO
COMMIT
select Has_Perms_By_Name(N'dbo.OwnerStatus', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.OwnerStatus', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.OwnerStatus', 'Object', 'CONTROL') as Contr_Per 