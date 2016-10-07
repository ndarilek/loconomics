/*
   jueves, 18 de febrero de 201619:08:09
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
ALTER TABLE dbo.booking SET (LOCK_ESCALATION = TABLE)
GO
COMMIT
select Has_Perms_By_Name(N'dbo.booking', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.booking', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.booking', 'Object', 'CONTROL') as Contr_Per BEGIN TRANSACTION
GO
ALTER TABLE dbo.ServiceProfessionalClient ADD
	CreatedByBookingID int NULL
GO
ALTER TABLE dbo.ServiceProfessionalClient ADD CONSTRAINT
	FK_ServiceProfessionalClient_booking FOREIGN KEY
	(
	CreatedByBookingID
	) REFERENCES dbo.booking
	(
	BookingID
	) ON UPDATE  NO ACTION 
	 ON DELETE  NO ACTION 
	
GO
ALTER TABLE dbo.ServiceProfessionalClient SET (LOCK_ESCALATION = TABLE)
GO
COMMIT
select Has_Perms_By_Name(N'dbo.ServiceProfessionalClient', 'Object', 'ALTER') as ALT_Per, Has_Perms_By_Name(N'dbo.ServiceProfessionalClient', 'Object', 'VIEW DEFINITION') as View_def_Per, Has_Perms_By_Name(N'dbo.ServiceProfessionalClient', 'Object', 'CONTROL') as Contr_Per 