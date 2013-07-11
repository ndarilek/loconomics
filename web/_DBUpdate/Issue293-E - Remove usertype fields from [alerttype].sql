/*
   jueves, 11 de julio de 201318:46:11
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
ALTER TABLE dbo.alerttype
	DROP CONSTRAINT DF__alerttype__Provi__5AC46587
GO
ALTER TABLE dbo.alerttype
	DROP CONSTRAINT DF__alerttype__Custo__5BB889C0
GO
ALTER TABLE dbo.alerttype
	DROP COLUMN ProviderAlert, CustomerAlert
GO
ALTER TABLE dbo.alerttype SET (LOCK_ESCALATION = TABLE)
GO
COMMIT
select Has_Perms_By_Name(N'dbo.alerttype', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.alerttype', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.alerttype', 'Object', 'CONTROL') as Contr_Per 